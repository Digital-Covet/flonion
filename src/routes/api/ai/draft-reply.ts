import type { APIEvent } from "@solidjs/start/server";
import { runReviewPipeline } from "~/lib/agents/pipeline";
import { getSessionFromHeaders } from "~/lib/server-auth";

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
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
