import { Effect } from "effect";
import type { DbError } from "~/server/effect/errors";
import { requireSessionOrLogin } from "~/server/effect/guards";
import { runServerFn } from "~/server/effect/server-fn";
import { Db } from "~/server/effect/services/db";
import type { AnalyticsData } from "~/types/analytics";

/**
 * Campaign analytics for one owner's review links. Shared by
 * `getCampaignAnalytics()` and `GET /api/reviews/analytics`.
 */
export const loadCampaignAnalytics = Effect.fn("loadCampaignAnalytics")(
  function* (userId: string): Effect.fn.Return<AnalyticsData, DbError, Db> {
    const db = yield* Db;
    const [reviews, currentUser] = yield* Effect.all(
      [
        db.use((p) =>
          p.sharedReview.findMany({
            where: { userId },
            include: { analytics: true },
            orderBy: { createdAt: "desc" },
          }),
        ),
        db.use((p) =>
          p.user.findUnique({
            where: { id: userId },
            select: {
              businessId: true,
              business: { select: { id: true, qrScanCount: true } },
              team: { select: { id: true, qrScanCount: true } },
            },
          }),
        ),
      ],
      { concurrency: "unbounded" },
    );

    const business = currentUser?.business ?? currentUser?.team ?? null;
    const businessQrScanCount = business?.qrScanCount ?? 0;

    const sum = (pick: (r: (typeof reviews)[number]) => number) =>
      reviews.reduce((total, r) => total + pick(r), 0);

    const totalPlatformRedirects: Record<string, number> = {};
    for (const r of reviews) {
      const pr =
        (r.analytics?.platformRedirects as Record<string, number>) || {};
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
  },
);

/** Server-only body of `getCampaignAnalytics`. */
export function loadCampaignAnalyticsForSession(): Promise<AnalyticsData> {
  return runServerFn(
    Effect.gen(function* () {
      const session = yield* requireSessionOrLogin;
      return yield* loadCampaignAnalytics(session.user.id);
    }),
  );
}
