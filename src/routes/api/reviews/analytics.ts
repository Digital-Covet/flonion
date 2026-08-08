import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";
import { getSessionFromHeaders } from "~/lib/server-auth";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reviews = await prisma.sharedReview.findMany({
    where: { userId: session.session.userId },
    include: { analytics: true },
    orderBy: { createdAt: "desc" },
  });

  const totalVisits = reviews.reduce(
    (sum, r) => sum + (r.analytics?.visitCount ?? 0),
    0,
  );
  const totalReviews = reviews.reduce(
    (sum, r) => sum + (r.analytics?.reviewCount ?? 0),
    0,
  );
  const totalQrScans = reviews.reduce(
    (sum, r) => sum + (r.analytics?.qrScanCount ?? 0),
    0,
  );
  const totalRedirects = reviews.reduce(
    (sum, r) => sum + (r.analytics?.redirectCount ?? 0),
    0,
  );

  const breakdown = reviews.map((r) => ({
    id: r.id,
    text: r.text.slice(0, 60) + (r.text.length > 60 ? "..." : ""),
    rating: r.rating,
    reviewerName: r.reviewerName,
    visits: r.analytics?.visitCount ?? 0,
    reviews: r.analytics?.reviewCount ?? 0,
    qrScans: r.analytics?.qrScanCount ?? 0,
    redirects: r.analytics?.redirectCount ?? 0,
    createdAt: r.createdAt.toISOString(),
  }));

  return Response.json({
    totalVisits,
    totalReviews,
    totalQrScans,
    totalRedirects,
    totalLinks: reviews.length,
    reviews: breakdown,
  });
}
