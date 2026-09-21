import type { APIEvent } from "@solidjs/start/server";
import { writeLedger } from "~/lib/agents/ledger";
import { runReviewPipeline } from "~/lib/agents/pipeline";
import { getBusinessContext } from "~/lib/business-context";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";

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
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const body = await event.request.json();

    const { comment, starRating, reviewerName, tone } = body;

    // An empty comment is valid: Google allows rating-only reviews, and those
    // deserve a reply too. The sentiment stage falls back to the star rating.
    if (typeof comment !== "string" || comment.length > 4096) {
      return Response.json(
        { error: "comment must be a string of at most 4096 characters" },
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
    const start = Date.now();

    // Resolved alongside the pipeline so ledger rows can be attributed to the
    // business the user acts in, without adding a query to the response time.
    // A lookup failure only costs attribution, never the draft.
    const businessId = getBusinessContext(session.user.id).then(
      (ctx) => ctx?.businessId ?? null,
      () => null,
    );

    let result: Awaited<ReturnType<typeof runReviewPipeline>>;
    try {
      result = await runReviewPipeline({
        comment,
        starRating,
        reviewerName: reviewerName || "valued customer",
        tone: selectedTone,
        apiKey,
      });
    } catch (err) {
      // Write a failed ledger row off the critical path
      const latencyMs = Date.now() - start;
      const ip = getClientIp(event.request);
      void businessId.then((id) =>
        writeLedger({
          endpoint: "draft-reply",
          stage: "pipeline",
          usage: { promptTokens: 0, completionTokens: 0, model: "unknown" },
          latencyMs,
          ok: false,
          errorKind: err instanceof Error ? err.constructor.name : "unknown",
          userId: session.user.id,
          businessId: id,
          ip,
        }),
      );
      throw err;
    }

    // Write ledger rows off the critical path (fire-and-forget)
    const latencyMs = Date.now() - start;
    const ip = getClientIp(event.request);
    const usage = result.usage;
    void businessId.then((id) => {
      for (const u of usage) {
        void writeLedger({
          endpoint: "draft-reply",
          stage: u.model === "none" ? "sentiment" : "draft",
          usage: u,
          latencyMs: Math.round(latencyMs / usage.length),
          ok: true,
          userId: session.user.id,
          businessId: id,
          ip,
        });
      }
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
