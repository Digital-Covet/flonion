import type { APIEvent } from "@solidjs/start/server";
import { runSuggestionPipeline } from "~/lib/agents/pipeline";
import { checkRateLimit } from "~/lib/rate-limit";

const REVIEW_RATE_LIMIT = 10;
const IP_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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

    const ip =
      event.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      event.request.headers.get("x-real-ip") ||
      "unknown";

    if (reviewId) {
      const reviewLimit = checkRateLimit(
        `review:${reviewId}`,
        REVIEW_RATE_LIMIT,
        RATE_WINDOW_MS,
      );

      if (!reviewLimit.allowed) {
        return Response.json(
          { error: "Rate limit exceeded for this review. Please try again later." },
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

    const apiKey = getApiKey();

    const result = await runSuggestionPipeline({
      draftText: draftText || "",
      starRating,
      keywords: typeof keywords === "string" ? keywords : undefined,
      businessName: typeof businessName === "string" ? businessName : undefined,
      apiKey,
    });

    return Response.json({
      sentiment: result.sentiment,
      suggestedReviews: result.suggestedReviews,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
