import type { APIEvent } from "@solidjs/start/server";
import { runReviewPipeline } from "~/lib/agents/pipeline";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { checkRateLimit } from "~/lib/rate-limit";

// Each call runs a two-stage LLM pipeline, so it costs real money per request.
const USER_RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }
  return key;
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(
    `draft-reply:${session.user.id}`,
    USER_RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const body = await event.request.json();

    const { comment, starRating, reviewerName, tone } = body;

    if (!comment || typeof comment !== "string") {
      return Response.json(
        { error: "Missing required field: comment" },
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

    const validTones = ["professional", "friendly", "formal"] as const;
    const selectedTone = validTones.includes(tone) ? tone : "professional";

    const apiKey = getApiKey();

    const result = await runReviewPipeline({
      comment,
      starRating,
      reviewerName: reviewerName || "valued customer",
      tone: selectedTone,
      apiKey,
    });

    return Response.json({
      sentiment: result.sentiment,
      draftReply: result.draft,
    });
  } catch (err) {
    // Returning err.message leaked internals to the client -- a missing
    // DEEPSEEK_API_KEY surfaced the env var name verbatim.
    console.error("[ai/draft-reply] pipeline failed:", err);
    return Response.json(
      { error: "Could not generate a reply. Please try again." },
      { status: 500 },
    );
  }
}
