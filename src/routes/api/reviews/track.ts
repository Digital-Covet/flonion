import { randomUUID } from "node:crypto";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

const PLATFORM_SLUGS = new Set<string>(REVIEW_PLATFORMS.map((p) => p.slug));

// Public and unauthenticated, and every call is a DB write. Capped per IP so a
// single caller cannot inflate a business's metrics or use it as write load.
const TRACK_RATE_LIMIT = 60;
const TRACK_WINDOW_MS = 60 * 60 * 1000;

export async function POST(event: APIEvent) {
  const limit = checkRateLimit(
    `track:${getClientIp(event.request)}`,
    TRACK_RATE_LIMIT,
    TRACK_WINDOW_MS,
  );

  if (!limit.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await event.request.json();
    const { reviewId, type, platform } = body;

    if (!reviewId || typeof reviewId !== "string") {
      return Response.json({ error: "reviewId is required" }, { status: 400 });
    }

    if (
      type !== "visit" &&
      type !== "review" &&
      type !== "redirect" &&
      type !== "ai_copy"
    ) {
      return Response.json(
        { error: "type must be 'visit', 'review', 'redirect', or 'ai_copy'" },
        { status: 400 },
      );
    }

    // Each platform becomes a key in the review's JSON column, so only known
    // slugs are accepted; free-form strings let a caller grow it without bound.
    if (
      type === "redirect" &&
      platform !== undefined &&
      platform !== null &&
      !(typeof platform === "string" && PLATFORM_SLUGS.has(platform))
    ) {
      return Response.json({ error: "Unknown platform" }, { status: 400 });
    }

    const review = await prisma.sharedReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    if (type === "redirect" && platform) {
      // One statement, so concurrent redirects cannot overwrite each other's
      // increments the way a read-modify-write of the JSON did.
      await prisma.$executeRaw`
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
      `;
    } else {
      await prisma.reviewAnalytics.upsert({
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
      });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
