import { Config, Effect, Option } from "effect";
import { runSuggestionPipeline } from "~/lib/agents/pipeline";
import {
  type Attribution,
  recordFailure,
  recordSuccess,
} from "~/server/effect/ai-ledger";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import {
  clientIp,
  currentSession,
  orElseAll,
  rateLimit,
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const REVIEW_RATE_LIMIT = 10;
const IP_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Public endpoint that sends these fields to the LLM on our key, so their size
// is our cost.
const MAX_DRAFT_LENGTH = 2000;
const MAX_KEYWORDS_LENGTH = 500;
const MAX_BUSINESS_NAME_LENGTH = 120;

// Backstop for when per-IP limits are evaded: total tokens this endpoint may
// spend per UTC day, read from the ai_usage ledger.
const DEFAULT_DAILY_TOKEN_BUDGET = 2_000_000;
const BUDGET_CACHE_MS = 10 * 1000;

/**
 * What one call is assumed to cost while it is in flight.
 *
 * Ledger rows are written after the LLM returns, so spend in flight is
 * invisible to the aggregate below: without a reservation a concurrent burst
 * only has to clear the check once, and the overshoot scales with concurrency
 * rather than with the budget. Reserving at admission and reconciling against
 * the ledger on each refresh bounds it instead.
 */
const ESTIMATED_TOKENS_PER_CALL = 2_000;

let budgetCache: { day: string; tokens: number; fetchedAt: number } | null =
  null;

/** Admitted-but-unledgered spend since `budgetCache` was last filled. */
let reservedSinceFetch = 0;

/** Called once per request that passes the budget check. */
function reserveDailyBudget() {
  reservedSinceFetch += ESTIMATED_TOKENS_PER_CALL;
}

/** Unset uses the default; a non-number or non-positive value disables it. */
const dailyBudget = Config.String("AI_SUGGEST_DAILY_TOKEN_BUDGET").pipe(
  Effect.map(Number),
  Effect.orElseSucceed(() => DEFAULT_DAILY_TOKEN_BUDGET),
);

const isDailyBudgetExhausted = Effect.gen(function* () {
  const budget = yield* dailyBudget;
  if (!Number.isFinite(budget) || budget <= 0) return false;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (
    !budgetCache ||
    budgetCache.day !== day ||
    now.getTime() - budgetCache.fetchedAt > BUDGET_CACHE_MS
  ) {
    const db = yield* Db;
    const totals = yield* db.use((p) =>
      p.aiUsage.aggregate({
        where: {
          endpoint: "suggest-review",
          createdAt: { gte: new Date(`${day}T00:00:00.000Z`) },
        },
        _sum: { promptTokens: true, completionTokens: true },
      }),
    );
    budgetCache = {
      day,
      tokens:
        (totals._sum.promptTokens ?? 0) + (totals._sum.completionTokens ?? 0),
      fetchedAt: now.getTime(),
    };
    // The aggregate now accounts for everything that finished, so the
    // running reservation starts again from there.
    reservedSinceFetch = 0;
  }
  return budgetCache.tokens + reservedSinceFetch >= budget;
});

/**
 * Truncates rather than rejects: review drafts can legitimately run longer
 * than the prompt needs, and the suggestion only has to capture their gist.
 */
function capped(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

/**
 * Who a suggestion's spend belongs to, for the ai_usage ledger.
 *
 * On the public review page the business is the one the shared review row was
 * created for, read from the database rather than taken from the request body,
 * which anyone can fill in. In the app, the caller is signed in and the
 * business is the one they act in. Never fails: attribution is bookkeeping and
 * must not fail a suggestion.
 */
const resolveAttribution = (reviewId: string | undefined) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const [review, session] = yield* Effect.all(
      [
        reviewId
          ? db.use((p) =>
              p.sharedReview.findUnique({
                where: { id: reviewId },
                select: { businessId: true },
              }),
            )
          : Effect.succeed(null),
        currentSession,
      ],
      { concurrency: "unbounded" },
    );
    const userId = Option.match(session, {
      onNone: () => null,
      onSome: (s) => s.user.id,
    });
    if (review?.businessId) return { userId, businessId: review.businessId };
    if (!userId) return { userId: null, businessId: null };
    const ctx = yield* requireBusinessContext(userId).pipe(
      Effect.map(Option.some),
      Effect.catchTag("NotFound", () => Effect.succeedNone),
    );
    return {
      userId,
      businessId: Option.match(ctx, {
        onNone: () => null,
        onSome: (c) => c.businessId,
      }),
    };
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        console.error("[ai/suggest-review] attribution failed:", cause),
      ),
    ),
    orElseAll((): Attribution => ({ userId: null, businessId: null })),
  );

// Returning err.message leaked internals to this public endpoint -- a missing
// DEEPSEEK_API_KEY once surfaced the env var name verbatim.
const failed = new UpstreamError({
  status: 500,
  message: "Could not generate suggestions. Please try again.",
});

export const POST = handler(
  "ai.suggest-review",
  Effect.gen(function* () {
    const { reviewId, draftText, starRating, keywords, businessName } =
      yield* readJsonObject(() => failed);

    if (reviewId !== undefined && typeof reviewId !== "string") {
      return yield* new BadRequest({ message: "reviewId must be a string" });
    }
    if (draftText !== undefined && typeof draftText !== "string") {
      return yield* new BadRequest({ message: "draftText must be a string" });
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

    if (reviewId) {
      yield* rateLimit(
        `review:${reviewId}`,
        REVIEW_RATE_LIMIT,
        RATE_WINDOW_MS,
        {
          message:
            "Rate limit exceeded for this review. Please try again later.",
        },
      );
    }
    yield* rateLimit(`ip:${ip}`, IP_RATE_LIMIT, RATE_WINDOW_MS, {
      message: "Rate limit exceeded. Please try again later.",
    });

    if (yield* isDailyBudgetExhausted) {
      return yield* new UpstreamError({
        status: 503,
        message: "Suggestions are unavailable right now. Please try later.",
      });
    }
    reserveDailyBudget();

    const start = Date.now();

    // Resolved alongside the pipeline, so attribution adds no response time.
    const attribution = yield* Effect.forkDetach(resolveAttribution(reviewId));
    const ledger = {
      endpoint: "suggest-review" as const,
      attribution,
      ip,
      reviewId: reviewId ?? null,
    };

    const result = yield* runSuggestionPipeline({
      draftText: capped(draftText, MAX_DRAFT_LENGTH) ?? "",
      starRating,
      keywords: capped(keywords, MAX_KEYWORDS_LENGTH),
      businessName: capped(businessName, MAX_BUSINESS_NAME_LENGTH),
    }).pipe(
      Effect.tapCause((cause) =>
        recordFailure({ ...ledger, latencyMs: Date.now() - start, cause }),
      ),
    );

    yield* recordSuccess({
      ...ledger,
      latencyMs: Date.now() - start,
      usage: result.usage,
      stageFor: (u) => (u.model === "none" ? "sentiment" : "suggest"),
    });

    return {
      sentiment: result.sentiment,
      suggestedReviews: result.suggestedReviews,
    };
  }).pipe(recoverUnexpected(failed, "[ai/suggest-review] pipeline failed:")),
);
