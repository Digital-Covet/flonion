import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const { reviewId, type, platform } = body;

    if (!reviewId || typeof reviewId !== "string") {
      return Response.json({ error: "reviewId is required" }, { status: 400 });
    }

    if (type !== "visit" && type !== "review" && type !== "redirect" && type !== "ai_copy") {
      return Response.json({ error: "type must be 'visit', 'review', 'redirect', or 'ai_copy'" }, { status: 400 });
    }

    if (type === "redirect" && platform && typeof platform !== "string") {
      return Response.json({ error: "platform must be a string" }, { status: 400 });
    }

    const review = await prisma.sharedReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    if (type === "redirect" && platform) {
      const existing = await prisma.reviewAnalytics.findUnique({
        where: { reviewId },
        select: { platformRedirects: true },
      });

      const currentRedirects = (existing?.platformRedirects as Record<string, number>) || {};
      const updatedRedirects: Record<string, number> = {
        ...currentRedirects,
        [platform]: (currentRedirects[platform] || 0) + 1,
      };

      await prisma.reviewAnalytics.upsert({
        where: { reviewId },
        create: {
          reviewId,
          visitCount: 0,
          reviewCount: 0,
          redirectCount: 1,
          aiCopyCount: 0,
          platformRedirects: { [platform]: 1 },
        },
        update: {
          redirectCount: { increment: 1 },
          platformRedirects: updatedRedirects,
        },
      });
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
