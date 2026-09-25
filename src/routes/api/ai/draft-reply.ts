import { Effect, Schema } from "effect";
import { runReviewPipeline } from "~/lib/agents/pipeline";
import { recordFailure, recordSuccess } from "~/server/effect/ai-ledger";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import {
  clientIp,
  orElseAll,
  rateLimit,
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";

// Each call runs a two-stage LLM pipeline, so it costs real money per request.
const USER_RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const Tone = Schema.Literals(["professional", "friendly", "formal"]);

// Returning err.message leaked internals to the client -- a missing
// DEEPSEEK_API_KEY once surfaced the env var name verbatim.
const failed = new UpstreamError({
  status: 500,
  message: "Could not generate a reply. Please try again.",
});

export const POST = handler(
  "ai.draft-reply",
  Effect.gen(function* () {
    const session = yield* requireSession();
    yield* rateLimit(
      `draft-reply:${session.user.id}`,
      USER_RATE_LIMIT,
      RATE_WINDOW_MS,
      {
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: true,
      },
    );

    return yield* Effect.gen(function* () {
      const { comment, starRating, reviewerName, tone } = yield* readJsonObject(
        () => failed,
      );

      // An empty comment is valid: Google allows rating-only reviews, and
      // those deserve a reply too. The sentiment stage falls back to the
      // star rating.
      if (typeof comment !== "string" || comment.length > 4096) {
        return yield* new BadRequest({
          message: "comment must be a string of at most 4096 characters",
        });
      }
      if (typeof starRating !== "number") {
        return yield* new BadRequest({
          message: "Missing required field: starRating (number)",
        });
      }
      if (starRating < 1 || starRating > 5) {
        return yield* new BadRequest({
          message: "starRating must be between 1 and 5",
        });
      }

      const ip = yield* clientIp;
      const start = Date.now();

      // Resolved alongside the pipeline so ledger rows can be attributed to
      // the business the user acts in, without adding response time. A
      // lookup failure only costs attribution, never the draft.
      const attribution = yield* Effect.forkDetach(
        requireBusinessContext(session.user.id).pipe(
          Effect.map((ctx) => ({
            userId: session.user.id,
            businessId: ctx.businessId as string | null,
          })),
          orElseAll(() => ({ userId: session.user.id, businessId: null })),
        ),
      );
      const ledger = {
        endpoint: "draft-reply" as const,
        attribution,
        ip,
      };

      const result = yield* runReviewPipeline({
        comment,
        starRating,
        reviewerName:
          typeof reviewerName === "string" && reviewerName
            ? reviewerName
            : "valued customer",
        tone: Schema.is(Tone)(tone) ? tone : "professional",
      }).pipe(
        Effect.tapCause((cause) =>
          recordFailure({ ...ledger, latencyMs: Date.now() - start, cause }),
        ),
      );

      yield* recordSuccess({
        ...ledger,
        latencyMs: Date.now() - start,
        usage: result.usage,
        stageFor: (u) => (u.model === "none" ? "sentiment" : "draft"),
      });

      return { sentiment: result.sentiment, draftReply: result.draft };
    }).pipe(recoverUnexpected(failed, "[ai/draft-reply] pipeline failed:"));
  }),
);
