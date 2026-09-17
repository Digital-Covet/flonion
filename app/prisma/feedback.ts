import { db } from "./db";
import { parsePageParams, offset, orderBy, likeTerm, pageResult, type PageResult } from "./paging";

export interface FeedbackRow {
  id: string;
  name: string;
  email: string;
  category: string;
  rating: number;
  message: string;
  status: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  operatorNote: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const SORT_MAP: Record<string, string> = {
  createdAt: "createdAt",
  rating: "rating",
  status: "status",
};

export async function listFeedback(
  searchParams: URLSearchParams,
): Promise<PageResult<FeedbackRow>> {
  const params = parsePageParams(searchParams, SORT_MAP, "createdAt");

  const where: Record<string, unknown> = {};

  const q = searchParams.get("q");
  if (q) {
    const term = likeTerm(q);
    where.OR = [
      { message: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const category = searchParams.get("category");
  if (category) where.category = category;

  const rating = searchParams.get("rating");
  if (rating) where.rating = Number.parseInt(rating, 10);

  const status = searchParams.get("status");
  if (status) where.status = status;

  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

  const [rows, total] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        id: true,
        name: true,
        email: true,
        category: true,
        rating: true,
        message: true,
        status: true,
        assignedTo: true,
        resolvedAt: true,
        operatorNote: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.feedback.count({ where }),
  ]);

  return pageResult(rows as FeedbackRow[], total, params);
}
