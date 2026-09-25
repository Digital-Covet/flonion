import { Effect, Option } from "effect";
import {
  getPlatformLabel,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";
import {
  MAX_LONG_FIELD,
  MAX_MEDIUM_FIELD,
  MAX_SHORT_FIELD,
  MAX_URL_LENGTH,
} from "~/lib/input-limits";
import { httpUrl, imageSrc, sanitizeReviewLinks } from "~/lib/safe-url";
import { loadBusinessInfo } from "~/server/business-data";
import { BadRequest, RawResponse } from "~/server/effect/errors";
import {
  checkFieldLimits,
  orElseAll,
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { catchUniqueViolation, Db } from "~/server/effect/services/db";
import { Google } from "~/server/effect/services/google";

const USERNAME_REGEX = /^[a-z0-9-]+$/;
const RESERVED_USERNAMES = [
  "admin",
  "api",
  "review",
  "qr",
  "dashboard",
  "settings",
  "login",
  "signup",
];
const MAX_USERNAME_LENGTH = 15;

/** Why `username` can't be used, or `null` when its shape is fine. */
function usernameProblem(username: string): string | null {
  if (username.length > MAX_USERNAME_LENGTH) {
    return `Username must be ${MAX_USERNAME_LENGTH} characters or less`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return "Username can only contain lowercase letters, numbers, and hyphens";
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return "This username is reserved";
  }
  return null;
}

/** Whether another owner already holds `username`. */
const isTakenByOther = (username: string, userId: string) =>
  Db.use((db) =>
    db.use((p) =>
      p.business.findFirst({
        where: { username, userId: { not: userId } },
      }),
    ),
  ).pipe(Effect.map(Boolean));

const invalidBody = new BadRequest({ message: "Invalid request body" });

/**
 * Kept for any client that still fetches this directly; pages read the same
 * data through `getBusiness()` instead. Both share `loadBusinessInfo` so the
 * two responses cannot drift.
 */
export const GET = handler(
  "business.get",
  Effect.gen(function* () {
    const session = yield* requireSession();
    return yield* loadBusinessInfo(session.user.id);
  }),
);

export const POST = handler(
  "business.save",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const userId = session.user.id;
    const db = yield* Db;

    // Guard: block users who belong to a business they do not own (invited
    // members). Owners keep write access — their own `businessId` points at
    // their own business, and this route doubles as the Settings save
    // endpoint.
    const existingUser = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: userId },
        select: { businessId: true, business: { select: { id: true } } },
      }),
    );
    if (
      existingUser?.businessId &&
      existingUser.businessId !== existingUser.business?.id
    ) {
      return yield* new BadRequest({
        message:
          "You are already part of a team. Cannot create a new business.",
      });
    }

    return yield* Effect.gen(function* () {
      const {
        placeId,
        reviewLink,
        reviewLinks,
        logo,
        businessName,
        username,
        phone,
        address,
        sector,
        keywords,
        description,
      } = yield* readJsonObject(() => invalidBody);

      if (typeof businessName !== "string" || !businessName.trim()) {
        return yield* new BadRequest({ message: "Business name is required" });
      }

      let normalizedUsername: string | null = null;
      if (typeof username === "string" && username.trim()) {
        const trimmed = username.trim().toLowerCase();
        const problem = usernameProblem(trimmed);
        if (problem) return yield* new BadRequest({ message: problem });
        if (yield* isTakenByOther(trimmed, userId)) {
          return yield* new BadRequest({
            message: "Username is already taken",
          });
        }
        normalizedUsername = trimmed;
      }

      yield* checkFieldLimits([
        { label: "Business name", value: businessName, max: MAX_SHORT_FIELD },
        { label: "Phone", value: phone, max: MAX_SHORT_FIELD },
        { label: "Sector", value: sector, max: MAX_SHORT_FIELD },
        { label: "Place ID", value: placeId, max: MAX_SHORT_FIELD },
        { label: "Address", value: address, max: MAX_MEDIUM_FIELD },
        { label: "Keywords", value: keywords, max: MAX_MEDIUM_FIELD },
        { label: "Description", value: description, max: MAX_LONG_FIELD },
        // `logo` is bounded by `imageSrc` below, which also allows an inline
        // `data:` image and so cannot share the plain URL ceiling.
        { label: "Review link", value: reviewLink, max: MAX_URL_LENGTH },
      ]);

      // Review links are navigated to on the public review page, so anything
      // other than an http(s) URL (e.g. `javascript:`) is stored XSS.
      const safeReviewLink = httpUrl(reviewLink);
      if (
        typeof reviewLink === "string" &&
        reviewLink.trim() &&
        !safeReviewLink
      ) {
        return yield* new BadRequest({
          message: "Review link must be a full http(s) URL",
        });
      }

      let safeReviewLinks: ReviewLinksMap | undefined;
      if (
        typeof reviewLinks === "object" &&
        reviewLinks !== null &&
        !Array.isArray(reviewLinks)
      ) {
        const sanitized = sanitizeReviewLinks(reviewLinks);
        if (!sanitized.ok) {
          return yield* new BadRequest({
            message: `The ${getPlatformLabel(sanitized.slug, {})} link must be a full http(s) URL`,
          });
        }
        safeReviewLinks = sanitized.links;
      }

      // The logo is rendered on the public review page, the company profile
      // and every marketplace card. It gets the same treatment as the links
      // above rather than a bare `typeof` check: an unvalidated string here is
      // an arbitrary scheme, an unbounded `data:` URI, or an off-origin tracker
      // that fires on every visitor's page load. Onboarding inlines small
      // images, so `imageSrc` allows a bounded `data:` image as well as an
      // http(s) URL.
      const safeLogo = imageSrc(logo);
      if (typeof logo === "string" && logo.trim() && !safeLogo) {
        return yield* new BadRequest({
          message: "Logo must be a full http(s) link or an inline image",
        });
      }

      const data = {
        placeId: typeof placeId === "string" ? placeId : null,
        reviewLink: safeReviewLink,
        reviewLinks: safeReviewLinks,
        logo: safeLogo,
        name: businessName.trim(),
        username: normalizedUsername,
        phone: typeof phone === "string" ? phone : null,
        address: typeof address === "string" ? address : null,
        sector: typeof sector === "string" ? sector : null,
        keywords: typeof keywords === "string" ? keywords : null,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
      };

      // The uniqueness probe above is a check-then-write; a concurrent claim
      // of the same username surfaces here as P2002.
      const business = yield* db
        .use((p) =>
          p.business.upsert({
            where: { userId },
            create: { userId, ...data },
            update: data,
          }),
        )
        .pipe(
          catchUniqueViolation(
            () => new BadRequest({ message: "Username is already taken" }),
          ),
        );

      yield* db.use((p) =>
        p.user.update({
          where: { id: userId },
          data: { onboardingCompleted: true, businessId: business.id },
        }),
      );

      // Someone who gave up waiting on a team and made their own business
      // would otherwise leave a live row in that team's queue, which an admin
      // can only resolve by clicking approve and getting an error.
      yield* db.use((p) =>
        p.joinRequest.updateMany({
          where: { userId, status: "pending" },
          data: { status: "cancelled", pendingUserId: null },
        }),
      );

      // Google's aggregate rating is cached on the business so the
      // marketplace can rank on it without an API round-trip per card. A
      // failed lookup keeps whatever was stored before rather than blocking
      // the save.
      let ratedBusiness = business;
      const placeIdSaved = business.placeId;
      if (placeIdSaved) {
        const google = yield* Google;
        const rating = yield* google.businessRating(userId, placeIdSaved);
        if (Option.isSome(rating)) {
          ratedBusiness = yield* db
            .use((p) =>
              p.business.update({
                where: { id: business.id },
                data: {
                  rating: rating.value.rating,
                  reviewCount: rating.value.reviewCount,
                },
              }),
            )
            .pipe(
              Effect.tapCause((cause) =>
                Effect.sync(() =>
                  console.error(
                    "[business] rating cache update failed:",
                    cause,
                  ),
                ),
              ),
              orElseAll(() => business),
            );
        }
      }

      const savedLinks =
        ratedBusiness.reviewLinks &&
        typeof ratedBusiness.reviewLinks === "object" &&
        !Array.isArray(ratedBusiness.reviewLinks)
          ? (ratedBusiness.reviewLinks as Record<string, string>)
          : {};

      return {
        placeId: ratedBusiness.placeId ?? "",
        reviewLink: ratedBusiness.reviewLink ?? "",
        reviewLinks: savedLinks,
        logo: ratedBusiness.logo ?? null,
        businessName: ratedBusiness.name,
        username: ratedBusiness.username ?? "",
        phone: ratedBusiness.phone ?? "",
        address: ratedBusiness.address ?? "",
        sector: ratedBusiness.sector ?? "",
        keywords: ratedBusiness.keywords ?? "",
        description: ratedBusiness.description ?? "",
        rating: ratedBusiness.rating ?? 0,
        reviewCount: ratedBusiness.reviewCount ?? 0,
        onboardingCompleted: true,
      };
    }).pipe(recoverUnexpected(invalidBody));
  }),
);

/** Checks whether a username is free, before the form is saved. */
export const PATCH = handler(
  "business.check-username",
  Effect.gen(function* () {
    const session = yield* requireSession();

    return yield* Effect.gen(function* () {
      const { username } = yield* readJsonObject(() => invalidBody);
      if (typeof username !== "string" || !username.trim()) {
        return yield* new BadRequest({ message: "Username is required" });
      }

      const trimmed = username.trim().toLowerCase();
      const problem = usernameProblem(trimmed);
      if (problem) {
        return yield* new RawResponse({
          response: Response.json(
            { available: false, error: problem },
            { status: 400 },
          ),
        });
      }

      const taken = yield* isTakenByOther(trimmed, session.user.id);
      return {
        available: !taken,
        error: taken ? "Username is already taken" : null,
      };
    }).pipe(recoverUnexpected(invalidBody));
  }),
);
