import type { APIEvent } from "@solidjs/start/server";
import { runSuggestionPipeline } from "~/lib/agents/pipeline";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }
  return key;
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();

    const { draftText, starRating, keywords } = body;

    if (!draftText || typeof draftText !== "string") {
      return Response.json(
        { error: "Missing required field: draftText" },
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

    const apiKey = getApiKey();

    const result = await runSuggestionPipeline({
      draftText,
      starRating,
      keywords: typeof keywords === "string" ? keywords : undefined,
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
