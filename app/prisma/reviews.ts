import { db } from "./db";
import { recordAudit } from "./audit";
import type { Operator } from "./operator";
import { parsePageParams, offset, orderBy, likeTerm, pageResult, type PageResult } from "./paging";

export interface ReviewRow {
  id: string;
  text: string;
  rating: number;
  reviewerName: string | null;
  keywords: string | null;
  status: string;
  hiddenById: string | null;
  hiddenAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  business: { id: string; name: string } | null;
  analytics: {
    visitCount: number;
    reviewCount: number;
    qrScanCount: number;
    redirectCount: number;
    aiCopyCount: number;
  } | null;
}

const SORT_MAP: Record<string, string> = {
  createdAt: "createdAt",
  rating: "rating",
};

export async function listReviews(
  searchParams: URLSearchParams,
): Promise<PageResult<ReviewRow>> {
  const params = parsePageParams(searchParams, SORT_MAP, "createdAt");

  const where: Record<string, unknown> = {};

  const q = searchParams.get("q");
  if (q) {
    const term = likeTerm(q);
    where.OR = [
      { text: { contains: term, mode: "insensitive" } },
      { reviewerName: { contains: term, mode: "insensitive" } },
      { keywords: { contains: term, mode: "insensitive" } },
    ];
  }

  const rating = searchParams.get("rating");
  if (rating) {
    const ratings = rating.split(",").map(Number).filter(Boolean);
    if (ratings.length === 1) where.rating = ratings[0];
    if (ratings.length > 1) where.rating = { in: ratings };
  }

  const status = searchParams.get("status");
  if (status) where.status = status;

  const businessId = searchParams.get("businessId");
  if (businessId) where.businessId = businessId;

  const hasAnalytics = searchParams.get("hasAnalytics");
  if (hasAnalytics === "true") where.analytics = { isNot: null };
  if (hasAnalytics === "false") where.analytics = null;

  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

  const [rows, total] = await Promise.all([
    db.sharedReview.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        id: true,
        text: true,
        rating: true,
        reviewerName: true,
        keywords: true,
        status: true,
        hiddenById: true,
        hiddenAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true } },
        analytics: {
          select: {
            visitCount: true,
            reviewCount: true,
            qrScanCount: true,
            redirectCount: true,
            aiCopyCount: true,
          },
        },
      },
    }),
    db.sharedReview.count({ where }),
  ]);

  return pageResult(rows as ReviewRow[], total, params);
}

export interface ReviewStats {
  total: number;
  avgRating: number | null;
  distribution: Record<number, number>;
  totalAiCopies: number;
  redirectConversions: number;
}

export async function getReviewStats(): Promise<ReviewStats> {
  const now = new Date().toISOString();

  const [total, avgResult, distribution, analyticsAgg] = await Promise.all([
    db.sharedReview.count(),
    db.sharedReview.aggregate({ _avg: { rating: true } }),
    db.sharedReview.groupBy({
      by: ["rating"],
      _count: { id: true },
    }),
    db.reviewAnalytics.aggregate({
      _sum: { aiCopyCount: true, redirectCount: true, reviewCount: true },
    }),
  ]);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) {
    dist[row.rating] = row._count.id;
  }

  return {
    total,
    avgRating: avgResult._avg.rating,
    distribution: dist,
    totalAiCopies: analyticsAgg._sum.aiCopyCount ?? 0,
    redirectConversions: analyticsAgg._sum.redirectCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Write helpers — review moderation
// ---------------------------------------------------------------------------

export async function setReviewStatus(
  id: string,
  status: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.sharedReview.findUnique({ where: { id }, select: { status: true, hiddenById: true, hiddenAt: true } });
    await tx.sharedReview.update({
      where: { id },
      data: {
        status,
        hiddenById: status === "visible" ? null : operator.id,
        hiddenAt: status === "visible" ? null : new Date(),
      },
    });
    await recordAudit(operator, {
      action: `review.status.${status}`,
      entity: "shared_review",
      entityId: id,
      before,
      after: { status, hiddenById: operator.id },
      ip,
    }, tx);
  });
}

export async function redactReviewText(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.sharedReview.findUnique({ where: { id }, select: { text: true } });
    await tx.sharedReview.update({ where: { id }, data: { text: "[redacted]" } });
    await recordAudit(operator, {
      action: "review.text.redact",
      entity: "shared_review",
      entityId: id,
      before,
      after: { text: "[redacted]" },
      ip,
    }, tx);
  });
}

export async function clearReviewerName(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.sharedReview.findUnique({ where: { id }, select: { reviewerName: true } });
    await tx.sharedReview.update({ where: { id }, data: { reviewerName: null } });
    await recordAudit(operator, {
      action: "review.reviewerName.clear",
      entity: "shared_review",
      entityId: id,
      before,
      after: { reviewerName: null },
      ip,
    }, tx);
  });
}

export async function deleteReview(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.sharedReview.findUnique({ where: { id }, select: { text: true, rating: true, userId: true } });
    await tx.sharedReview.delete({ where: { id } });
    await recordAudit(operator, {
      action: "review.delete",
      entity: "shared_review",
      entityId: id,
      before,
      note: `Deleted ${before?.rating}-star review by user ${before?.userId}`,
      ip,
    }, tx);
  });
}
