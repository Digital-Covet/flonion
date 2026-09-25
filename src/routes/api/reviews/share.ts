import { Effect, Option } from "effect";
import { issueReviewClaim, verifyReviewClaim } from "~/lib/review-claim";
import {
  BadRequest,
  Forbidden,
  NotFound,
  Unauthorized,
} from "~/server/effect/errors";
import {
  clientIp,
  currentSession,
  rateLimit,
  readJsonObject,
  recoverUnexpected,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const MAX_TEXT_LENGTH = 5000;
const MAX_NAME_LENGTH = 100;
const MAX_KEYWORDS_LENGTH = 500;

// Anonymous review rows feed a business's analytics and public review page,
// so creation is capped per caller and per business.
const ANON_CREATE_IP_LIMIT = 30; // customers at one venue often share an IP
const ANON_CREATE_IP_WINDOW_MS = 60 * 60 * 1000;
const ANON_CREATE_BUSINESS_LIMIT = 1000;
const ANON_CREATE_BUSINESS_WINDOW_MS = 24 * 60 * 60 * 1000;

const tooManyReviews = "Too many reviews submitted. Please try again later.";

/** `/company/<handle>/review` for the business this user owns. */
const reviewPageFor = Effect.fn("reviewPageFor")(function* (userId: string) {
  const db = yield* Db;
  const user = yield* db.use((p) =>
    p.user.findUnique({
      where: { id: userId },
      select: { business: { select: { id: true, username: true } } },
    }),
  );
  const param = user?.business?.username || user?.business?.id || "unknown";
  return `/company/${param}/review`;
});

const invalidRating = (range: "1 and 5" | "0 and 5") =>
  new BadRequest({ message: `rating must be a number between ${range}` });

const trimmedOr = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

export const POST = handler(
  "reviews.share.save",
  Effect.gen(function* () {
    const session = Option.getOrNull(yield* currentSession);
    const body = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    const {
      text,
      rating,
      keywords,
      id,
      username: businessUsername,
      businessId,
      reviewerName,
      claimToken,
      fresh,
    } = body;

    if (
      id &&
      rating !== 0 &&
      (typeof rating !== "number" || rating < 1 || rating > 5)
    ) {
      return yield* invalidRating("1 and 5");
    }
    if (typeof text === "string" && text.length > MAX_TEXT_LENGTH) {
      return yield* new BadRequest({ message: "text is too long" });
    }
    if (
      typeof reviewerName === "string" &&
      reviewerName.length > MAX_NAME_LENGTH
    ) {
      return yield* new BadRequest({ message: "reviewerName is too long" });
    }
    if (typeof keywords === "string" && keywords.length > MAX_KEYWORDS_LENGTH) {
      return yield* new BadRequest({ message: "keywords is too long" });
    }

    const db = yield* Db;
    const bodyText = typeof text === "string" ? text.trim() : "";

    if (id) {
      // Prisma rejected a non-string id, which answered the generic 400.
      if (typeof id !== "string") {
        return yield* new BadRequest({ message: "Invalid request body" });
      }
      const existing = yield* db.use((p) =>
        p.sharedReview.findUnique({ where: { id } }),
      );
      if (!existing)
        return yield* new NotFound({ message: "Review not found" });

      const isOwner = !!session && existing.userId === session.session.userId;

      // Writing to an existing row requires either owning it or holding the
      // claim token handed out when it was created. Knowing the id is not
      // enough: these rows render on the business's public review page, so
      // an unauthenticated overwrite is content injection on a
      // customer-facing surface.
      if (!isOwner && !verifyReviewClaim(claimToken, id)) {
        return yield* new Forbidden({ message: "Forbidden" });
      }

      const review = yield* db.use((p) =>
        p.sharedReview.update({
          where: { id },
          data: {
            text: bodyText,
            rating: rating !== 0 ? (rating as number) : existing.rating,
            // Owners edit the composer's optional customer name as they type.
            reviewerName: isOwner
              ? trimmedOr(reviewerName, session.user.name)
              : trimmedOr(reviewerName, session?.user.name ?? "Anonymous"),
            // `keywords` is owner-configured SEO input that is served back to
            // every visitor and fed into the AI prompt. Anonymous callers
            // must not set it.
            keywords:
              isOwner && typeof keywords === "string"
                ? keywords
                : existing.keywords,
          },
          select: { id: true, userId: true },
        }),
      );

      return {
        url: yield* reviewPageFor(review.userId),
        reviewId: review.id,
      };
    }

    if ((businessUsername || businessId) && !session) {
      const business = yield* db.use((p) =>
        p.business.findUnique({
          where: businessUsername
            ? { username: businessUsername as string }
            : { id: businessId as string },
          select: { id: true, userId: true, keywords: true },
        }),
      );
      if (!business) {
        return yield* new NotFound({ message: "Business not found" });
      }
      if (typeof rating !== "number" || rating < 0 || rating > 5) {
        return yield* invalidRating("0 and 5");
      }

      yield* rateLimit(
        `share-create-ip:${yield* clientIp}`,
        ANON_CREATE_IP_LIMIT,
        ANON_CREATE_IP_WINDOW_MS,
        { message: tooManyReviews },
      );
      yield* rateLimit(
        `share-create-business:${business.id}`,
        ANON_CREATE_BUSINESS_LIMIT,
        ANON_CREATE_BUSINESS_WINDOW_MS,
        { message: tooManyReviews },
      );

      const created = yield* db.use((p) =>
        p.sharedReview.create({
          data: {
            text: bodyText,
            rating,
            reviewerName: trimmedOr(reviewerName, "Anonymous"),
            keywords: business.keywords || null,
            userId: business.userId,
            businessId: business.id,
          },
          select: { id: true },
        }),
      );

      // The id and its claim token go back so the visitor can fill in the row
      // they just created. Without them the page had no usable id and created
      // a second row on submit, leaving an empty one behind and losing the
      // visit.
      return {
        ok: true,
        reviewId: created.id,
        claimToken: issueReviewClaim(created.id),
      };
    }

    if (!session) return yield* new Unauthorized({ message: "Unauthorized" });
    const userId = session.session.userId;

    // Legacy callers get their latest link back; the composer sends
    // `fresh: true` because every request it creates is a new link and QR.
    if (fresh !== true) {
      const existing = yield* db.use((p) =>
        p.sharedReview.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true, userId: true },
        }),
      );
      if (existing) {
        return {
          url: yield* reviewPageFor(existing.userId),
          reviewId: existing.id,
        };
      }
    }

    if (typeof rating !== "number" || rating < 0 || rating > 5) {
      return yield* invalidRating("0 and 5");
    }

    // The business the review belongs to: the one the user owns, else the
    // team they belong to.
    const sessionUser = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: userId },
        select: { businessId: true, business: { select: { id: true } } },
      }),
    );

    const review = yield* db.use((p) =>
      p.sharedReview.create({
        data: {
          text: bodyText,
          rating,
          // The composer's optional customer name; the customer can change it
          // when they submit.
          reviewerName: trimmedOr(reviewerName, session.user.name),
          keywords: typeof keywords === "string" ? keywords : null,
          userId,
          businessId:
            sessionUser?.business?.id ?? sessionUser?.businessId ?? null,
        },
      }),
    );

    return { url: yield* reviewPageFor(userId), reviewId: review.id };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);

export const GET = handler(
  "reviews.share.get",
  Effect.gen(function* () {
    const { url } = yield* RequestContext;
    const id = url.searchParams.get("id");
    const username = url.searchParams.get("username");
    const businessId = url.searchParams.get("businessId");

    if (!id && !username && !businessId) {
      return yield* new BadRequest({
        message: "Missing id, username, or businessId parameter",
      });
    }

    const db = yield* Db;

    if ((username || businessId) && !id) {
      const business = yield* db.use((p) =>
        p.business.findUnique({
          where: username
            ? { username, status: "active" }
            : { id: businessId as string, status: "active" },
          select: {
            id: true,
            logo: true,
            name: true,
            phone: true,
            address: true,
            placeId: true,
            reviewLink: true,
            reviewLinks: true,
            keywords: true,
            username: true,
          },
        }),
      );
      if (!business) {
        return yield* new NotFound({ message: "Business not found" });
      }

      const { keywords, ...rest } = business;
      return {
        keywords,
        business: {
          logo: rest.logo,
          name: rest.name,
          phone: rest.phone,
          address: rest.address,
          placeId: rest.placeId,
          reviewLink: rest.reviewLink,
          reviewLinks: rest.reviewLinks,
          username: rest.username,
          id: rest.id,
        },
      };
    }

    if (!id) return yield* new BadRequest({ message: "Missing id parameter" });

    // Only a visible request is served; hidden or flagged ones read as missing.
    const review = yield* db.use((p) =>
      p.sharedReview.findUnique({
        where: { id, status: "visible" },
        select: {
          id: true,
          text: true,
          rating: true,
          reviewerName: true,
          keywords: true,
          createdAt: true,
          user: {
            select: {
              business: {
                select: {
                  id: true,
                  username: true,
                  logo: true,
                  name: true,
                  phone: true,
                  address: true,
                  placeId: true,
                  reviewLink: true,
                  reviewLinks: true,
                },
              },
            },
          },
        },
      }),
    );
    if (!review) return yield* new NotFound({ message: "Review not found" });

    return {
      ...review,
      business: review.user?.business ?? null,
      user: undefined,
    };
  }),
);
