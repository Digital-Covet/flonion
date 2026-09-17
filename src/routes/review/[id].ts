import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// Server-side instant resolve (spec §6): 302 with no UI flash, visit counted
// with the same per-IP cap as POST /api/reviews/track. Invalid IDs redirect
// to the 404 page (Home + Search + Back) instead of a dead card.
export async function GET(event: APIEvent) {
  const id = event.params.id;

  if (!id || typeof id !== "string") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/404" },
    });
  }

  try {
    const review = await prisma.sharedReview.findUnique({
      where: { id },
      select: {
        id: true,
        user: {
          select: {
            business: { select: { id: true, username: true } },
          },
        },
      },
    });

    const param =
      review?.user?.business?.username || review?.user?.business?.id;

    if (!review || !param) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/404" },
      });
    }

    const countable = checkRateLimit(
      `track:${getClientIp(event.request)}`,
      60,
      60 * 60 * 1000,
    );

    if (countable.allowed) {
      await prisma.reviewAnalytics.upsert({
        where: { reviewId: review.id },
        create: {
          reviewId: review.id,
          visitCount: 1,
          reviewCount: 0,
          redirectCount: 0,
          aiCopyCount: 0,
        },
        update: { visitCount: { increment: 1 } },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/company/${param}/review`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const referenceId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());
    console.error(`[review/redirect] ${referenceId}:`, err);
    return new Response(null, {
      status: 302,
      headers: { Location: `/500?ref=${referenceId}` },
    });
  }
}
