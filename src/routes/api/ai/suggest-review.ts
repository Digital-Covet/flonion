import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { writeLedger } from "~/lib/agents/ledger";
import { runSuggestionPipeline } from "~/lib/agents/pipeline";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

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
const BUDGET_CACHE_MS = 60 * 1000;

let budgetCache: { day: string; tokens: number; fetchedAt: number } | null =
  null;

async function isDailyBudgetExhausted(): Promise<boolean> {
  const budget = Number(
    process.env.AI_SUGGEST_DAILY_TOKEN_BUDGET ?? DEFAULT_DAILY_TOKEN_BUDGET,
  );
  if (!Number.isFinite(budget) || budget <= 0) return false;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (
    !budgetCache ||
    budgetCache.day !== day ||
    now.getTime() - budgetCache.fetchedAt > BUDGET_CACHE_MS
  ) {
    const totals = await prisma.aiUsage.aggregate({
      where: {
        endpoint: "suggest-review",
        createdAt: { gte: new Date(`${day}T00:00:00.000Z`) },
      },
      _sum: { promptTokens: true, completionTokens: true },
    });
    budgetCache = {
      day,
      tokens:
        (totals._sum.promptTokens ?? 0) + (totals._sum.completionTokens ?? 0),
      fetchedAt: now.getTime(),
    };
  }
  return budgetCache.tokens >= budget;
}

/**
 * Truncates rather than rejects: review drafts can legitimately run longer
 * than the prompt needs, and the suggestion only has to capture their gist.
 */
function capped(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }
  return key;
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();

    const { reviewId, draftText, starRating, keywords, businessName } = body;

    if (reviewId !== undefined && typeof reviewId !== "string") {
      return Response.json(
        { error: "reviewId must be a string" },
        { status: 400 },
      );
    }

    if (draftText !== undefined && typeof draftText !== "string") {
      return Response.json(
        { error: "draftText must be a string" },
        { status: 400 },
      );
    }

    if (starRating === undefined || typeof starRating !== "number") {
      return Response.json(
        { error: "Missing required field: starRating (number)" },
        { status: 400 },
      );
    }

    if (starRating < 1 || starRating > 5) {
      return Response.json(
        { error: "starRating must be between 1 and 5" },
        { status: 400 },
      );
    }

    const ip = getClientIp(event.request);

    if (reviewId) {
      const reviewLimit = checkRateLimit(
        `review:${reviewId}`,
        REVIEW_RATE_LIMIT,
        RATE_WINDOW_MS,
      );

      if (!reviewLimit.allowed) {
        return Response.json(
          {
            error:
              "Rate limit exceeded for this review. Please try again later.",
          },
          { status: 429 },
        );
      }
    }

    const ipLimit = checkRateLimit(`ip:${ip}`, IP_RATE_LIMIT, RATE_WINDOW_MS);

    if (!ipLimit.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    if (await isDailyBudgetExhausted()) {
      return Response.json(
        { error: "Suggestions are unavailable right now. Please try later." },
        { status: 503 },
      );
    }

    const apiKey = getApiKey();
    const start = Date.now();

    let result: Awaited<ReturnType<typeof runSuggestionPipeline>>;
    try {
      result = await runSuggestionPipeline({
        draftText: capped(draftText, MAX_DRAFT_LENGTH) ?? "",
        starRating,
        keywords: capped(keywords, MAX_KEYWORDS_LENGTH),
        businessName: capped(businessName, MAX_BUSINESS_NAME_LENGTH),
        apiKey,
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      void writeLedger({
        endpoint: "suggest-review",
        stage: "pipeline",
        usage: { promptTokens: 0, completionTokens: 0, model: "unknown" },
        latencyMs,
        ok: false,
        errorKind: err instanceof Error ? err.constructor.name : "unknown",
        ip,
      });
      throw err;
    }

    // Write ledger rows off the critical path (fire-and-forget)
    const latencyMs = Date.now() - start;
    for (const u of result.usage) {
      void writeLedger({
        endpoint: "suggest-review",
        stage: u.model === "none" ? "sentiment" : "suggest",
        usage: u,
        latencyMs: Math.round(latencyMs / result.usage.length),
        ok: true,
        userId: null,
        businessId: null,
        reviewId: reviewId ?? null,
        ip,
      });
    }

    return Response.json({
      sentiment: result.sentiment,
      suggestedReviews: result.suggestedReviews,
    });
  } catch (err) {
    // Returning err.message leaked internals to this public endpoint -- a
    // missing DEEPSEEK_API_KEY surfaced the env var name verbatim.
    console.error("[ai/suggest-review] pipeline failed:", err);
    return Response.json(
      { error: "Could not generate suggestions. Please try again." },
      { status: 500 },
    );
  }
}
