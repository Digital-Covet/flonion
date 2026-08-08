import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const { reviewId, type } = body;

    if (!reviewId || typeof reviewId !== "string") {
      return Response.json({ error: "reviewId is required" }, { status: 400 });
    }

    if (type !== "visit" && type !== "review" && type !== "redirect") {
      return Response.json({ error: "type must be 'visit', 'review', or 'redirect'" }, { status: 400 });
    }

    const review = await prisma.sharedReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    await prisma.reviewAnalytics.upsert({
      where: { reviewId },
      create: {
        reviewId,
        visitCount: type === "visit" ? 1 : 0,
        reviewCount: type === "review" ? 1 : 0,
        redirectCount: type === "redirect" ? 1 : 0,
      },
      update: {
        ...(type === "visit"
          ? { visitCount: { increment: 1 } }
          : type === "redirect"
            ? { redirectCount: { increment: 1 } }
            : { reviewCount: { increment: 1 } }),
      },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
