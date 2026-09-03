import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";

export async function GET(event: APIEvent) {
  const id = event.params.id;

  if (!id || typeof id !== "string") {
    return new Response("Not found", { status: 404 });
  }

  try {
    const review = await prisma.sharedReview.findUnique({
      where: { id },
      select: {
        id: true,
        user: {
          select: {
            business: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!review) {
      return new Response("Not found", { status: 404 });
    }

    const param = review.user?.business?.username || review.user?.business?.id || "unknown";

    const userAgent = event.request.headers.get("user-agent") || "";
    const ip =
      event.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      event.request.headers.get("x-real-ip") ||
      "unknown";

    await prisma.reviewAnalytics.upsert({
      where: { reviewId: id },
      create: {
        reviewId: id,
        qrScanCount: 1,
      },
      update: {
        qrScanCount: { increment: 1 },
      },
    });

    const destination = `/company/${param}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
