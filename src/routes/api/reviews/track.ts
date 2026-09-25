import { randomUUID } from "node:crypto";
import { Effect, Predicate, Schema } from "effect";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import { BadRequest, NotFound } from "~/server/effect/errors";
import {
  clientIp,
  rateLimit,
  readJsonBody,
  recoverAll,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const ReviewId = Schema.NonEmptyString;
const TrackType = Schema.Literals(["visit", "review", "redirect", "ai_copy"]);
// Each platform becomes a key in the review's JSON column, so only known
// slugs are accepted; free-form strings let a caller grow it without bound.
const Platform = Schema.NullishOr(
  Schema.Literals(REVIEW_PLATFORMS.map((p) => p.slug)),
);

// Public and unauthenticated, and every call is a DB write. Capped per IP so a
// single caller cannot inflate a business's metrics or use it as write load.
const TRACK_RATE_LIMIT = 60;
const TRACK_WINDOW_MS = 60 * 60 * 1000;

/** What this route has always answered for a malformed body or a failed write. */
const invalidRequest = new BadRequest({ message: "Invalid request" });

export const POST = handler(
  "reviews.track",
  Effect.gen(function* () {
    const ip = yield* clientIp;
    yield* rateLimit(`track:${ip}`, TRACK_RATE_LIMIT, TRACK_WINDOW_MS, {
      message: "Rate limit exceeded",
    });

    const body = yield* readJsonBody(() => invalidRequest);
    if (body === null || body === undefined) return yield* invalidRequest;
    const { reviewId, type, platform } = (
      Predicate.isObject(body) ? body : {}
    ) as Record<string, unknown>;

    if (!Schema.is(ReviewId)(reviewId)) {
      return yield* new BadRequest({ message: "reviewId is required" });
    }
    if (!Schema.is(TrackType)(type)) {
      return yield* new BadRequest({
        message: "type must be 'visit', 'review', 'redirect', or 'ai_copy'",
      });
    }
    if (type === "redirect" && !Schema.is(Platform)(platform)) {
      return yield* new BadRequest({ message: "Unknown platform" });
    }

    const db = yield* Db;

    // Hidden or flagged requests are not public, so they are not counted.
    const review = yield* db
      .use((p) =>
        p.sharedReview.findUnique({
          where: { id: reviewId, status: "visible" },
          select: { id: true },
        }),
      )
      .pipe(recoverAll(invalidRequest));

    if (!review) {
      return yield* new NotFound({ message: "Review not found" });
    }

    if (type === "redirect" && typeof platform === "string" && platform) {
      // One statement, so concurrent redirects cannot overwrite each other's
      // increments the way a read-modify-write of the JSON did.
      yield* db
        .use(
          (p) => p.$executeRaw`
        INSERT INTO review_analytics
          (id, "reviewId", "visitCount", "reviewCount", "redirectCount", "aiCopyCount", "platformRedirects", "createdAt", "updatedAt")
        VALUES
          (${randomUUID()}, ${reviewId}, 0, 0, 1, 0, jsonb_build_object(${platform}::text, 1), now(), now())
        ON CONFLICT ("reviewId") DO UPDATE SET
          "redirectCount" = review_analytics."redirectCount" + 1,
          "platformRedirects" = jsonb_set(
            COALESCE(review_analytics."platformRedirects", '{}'::jsonb),
            ARRAY[${platform}::text],
            to_jsonb(COALESCE((review_analytics."platformRedirects" ->> ${platform}::text)::int, 0) + 1)
          ),
          "updatedAt" = now()
      `,
        )
        .pipe(recoverAll(invalidRequest));
    } else {
      yield* db
        .use((p) =>
          p.reviewAnalytics.upsert({
            where: { reviewId },
            create: {
              reviewId,
              visitCount: type === "visit" ? 1 : 0,
              reviewCount: type === "review" ? 1 : 0,
              redirectCount: type === "redirect" ? 1 : 0,
              aiCopyCount: type === "ai_copy" ? 1 : 0,
            },
            update: {
              ...(type === "visit"
                ? { visitCount: { increment: 1 } }
                : type === "redirect"
                  ? { redirectCount: { increment: 1 } }
                  : type === "ai_copy"
                    ? { aiCopyCount: { increment: 1 } }
                    : { reviewCount: { increment: 1 } }),
            },
          }),
        )
        .pipe(recoverAll(invalidRequest));
    }

    return { ok: true };
  }),
);
