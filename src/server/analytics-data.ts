import type { AnalyticsData } from "~/types/analytics";

/**
 * Campaign analytics for one owner's review links. Shared by
 * `getCampaignAnalytics()` and `GET /api/reviews/analytics`.
 */
export async function loadCampaignAnalytics(
  userId: string,
): Promise<AnalyticsData> {
  const { prisma } = await import("~/db/prisma");

  const [reviews, currentUser] = await Promise.all([
    prisma.sharedReview.findMany({
      where: { userId },
      include: { analytics: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        businessId: true,
        business: { select: { id: true, qrScanCount: true } },
        team: { select: { id: true, qrScanCount: true } },
      },
    }),
  ]);

  const business = currentUser?.business ?? currentUser?.team ?? null;
  const businessQrScanCount = business?.qrScanCount ?? 0;

  const sum = (pick: (r: (typeof reviews)[number]) => number) =>
    reviews.reduce((total, r) => total + pick(r), 0);

  const totalPlatformRedirects: Record<string, number> = {};
  for (const r of reviews) {
    const pr = (r.analytics?.platformRedirects as Record<string, number>) || {};
    for (const [key, val] of Object.entries(pr)) {
      totalPlatformRedirects[key] = (totalPlatformRedirects[key] || 0) + val;
    }
  }

  return {
    totalVisits: sum((r) => r.analytics?.visitCount ?? 0),
    totalReviews: sum((r) => r.analytics?.reviewCount ?? 0),
    // Scans counted on the business itself (the printed counter sheet) belong
    // to no single link, so they are added on top of the per-link totals.
    totalQrScans:
      sum((r) => r.analytics?.qrScanCount ?? 0) + businessQrScanCount,
    totalRedirects: sum((r) => r.analytics?.redirectCount ?? 0),
    totalAiCopies: sum((r) => r.analytics?.aiCopyCount ?? 0),
    totalPlatformRedirects,
    totalLinks: reviews.length,
    reviews: reviews.map((r) => ({
      id: r.id,
      text: r.text.slice(0, 60) + (r.text.length > 60 ? "..." : ""),
      rating: r.rating,
      reviewerName: r.reviewerName,
      visits: r.analytics?.visitCount ?? 0,
      reviews: r.analytics?.reviewCount ?? 0,
      qrScans: r.analytics?.qrScanCount ?? 0,
      redirects: r.analytics?.redirectCount ?? 0,
      aiCopies: r.analytics?.aiCopyCount ?? 0,
      platformRedirects:
        (r.analytics?.platformRedirects as Record<string, number>) || {},
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
