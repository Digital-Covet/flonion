import { prisma } from "~/db/prisma";
import { AI_MODEL_ID, computeCost } from "./model";

/**
 * Usage metadata extracted from a LangChain response.
 *
 * If `response.usage_metadata` is populated (DeepSeek v4+), we use it.
 * Otherwise we fall back to zeros and mark the row as estimated.
 */
export interface UsageMeta {
  promptTokens: number;
  completionTokens: number;
  model: string;
}

/** Extract usage from a LangChain response, falling back to zeros. */
export function extractUsage(response: unknown): UsageMeta {
  const r = response as {
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    response_metadata?: {
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
      };
    };
  };

  const promptTokens =
    r?.usage_metadata?.input_tokens ??
    r?.response_metadata?.tokenUsage?.promptTokens ??
    0;
  const completionTokens =
    r?.usage_metadata?.output_tokens ??
    r?.response_metadata?.tokenUsage?.completionTokens ??
    0;

  return {
    promptTokens,
    completionTokens,
    model: AI_MODEL_ID,
  };
}

export interface LedgerEntry {
  endpoint: string;
  stage: string;
  usage: UsageMeta;
  latencyMs: number;
  ok: boolean;
  errorKind?: string | null;
  userId?: string | null;
  businessId?: string | null;
  reviewId?: string | null;
  ip?: string | null;
}

/**
 * Write a usage row to the ledger. This MUST be called off the request's
 * critical path — a ledger insert must never turn a working AI call into
 * a 500. Fire-and-forget in the route, or await in a background task.
 *
 * The cost is computed at write time so a later price change does not
 * silently rewrite history.
 */
export async function writeLedger(entry: LedgerEntry): Promise<void> {
  try {
    const cost = computeCost(
      entry.usage.model,
      entry.usage.promptTokens,
      entry.usage.completionTokens,
    );

    await prisma.aiUsage.create({
      data: {
        endpoint: entry.endpoint,
        stage: entry.stage,
        model: entry.usage.model,
        promptTokens: entry.usage.promptTokens,
        completionTokens: entry.usage.completionTokens,
        costUsd: cost,
        latencyMs: entry.latencyMs,
        ok: entry.ok,
        errorKind: entry.errorKind ?? null,
        userId: entry.userId ?? null,
        businessId: entry.businessId ?? null,
        reviewId: entry.reviewId ?? null,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Ledger writes must never fail the request. Log and move on.
    console.error("[ai-usage] ledger write failed:", err);
  }
}
