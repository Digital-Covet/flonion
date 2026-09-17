import { db } from "./db";
import { parsePageParams, offset, orderBy, pageResult, type PageResult } from "./paging";

export interface AiUsageRow {
  id: string;
  userId: string | null;
  businessId: string | null;
  endpoint: string;
  stage: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: string | null;
  latencyMs: number;
  ok: boolean;
  errorKind: string | null;
  reviewId: string | null;
  ip: string | null;
  createdAt: string;
}

const SORT_MAP: Record<string, string> = {
  createdAt: "createdAt",
  costUsd: "costUsd",
  latencyMs: "latencyMs",
};

export async function listAiUsage(
  searchParams: URLSearchParams,
): Promise<PageResult<AiUsageRow>> {
  const params = parsePageParams(searchParams, SORT_MAP, "createdAt");

  const where: Record<string, unknown> = {};

  const endpoint = searchParams.get("endpoint");
  if (endpoint) where.endpoint = endpoint;

  const stage = searchParams.get("stage");
  if (stage) where.stage = stage;

  const model = searchParams.get("model");
  if (model) where.model = model;

  const ok = searchParams.get("ok");
  if (ok === "true") where.ok = true;
  if (ok === "false") where.ok = false;

  const userId = searchParams.get("userId");
  if (userId) where.userId = userId;

  const businessId = searchParams.get("businessId");
  if (businessId) where.businessId = businessId;

  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

  const [rows, total] = await Promise.all([
    db.aiUsage.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
    }),
    db.aiUsage.count({ where }),
  ]);

  return pageResult(rows as AiUsageRow[], total, params);
}

export interface AiUsageStats {
  totalCalls: number;
  totalCost: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  successRate: number;
  p50Latency: number;
  p95Latency: number;
  rateLimitRejections: number;
}

export async function getAiUsageStats(
  windowDays = 30,
): Promise<AiUsageStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString();

  const where = { createdAt: { gte: cutoffStr } };

  const [agg, latencyRows, rateLimitCount] = await Promise.all([
    db.aiUsage.aggregate({
      where,
      _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
    }),
    db.aiUsage.findMany({
      where: { ...where, ok: true },
      select: { latencyMs: true },
      orderBy: { latencyMs: "asc" },
    }),
    db.aiUsage.count({
      where: { ...where, ok: false, errorKind: "rate_limit" },
    }),
  ]);

  const totalCalls = agg._count.id;
  const totalCost = agg._sum.costUsd
    ? Number.parseFloat(String(agg._sum.costUsd))
    : 0;
  const successCount = await db.aiUsage.count({ where: { ...where, ok: true } });

  const p50 = latencyRows[Math.floor(latencyRows.length * 0.5)]?.latencyMs ?? 0;
  const p95 = latencyRows[Math.floor(latencyRows.length * 0.95)]?.latencyMs ?? 0;

  return {
    totalCalls,
    totalCost,
    totalPromptTokens: agg._sum.promptTokens ?? 0,
    totalCompletionTokens: agg._sum.completionTokens ?? 0,
    successRate: totalCalls > 0 ? successCount / totalCalls : 1,
    p50Latency: p50,
    p95Latency: p95,
    rateLimitRejections: rateLimitCount,
  };
}
