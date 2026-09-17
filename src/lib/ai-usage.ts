import { prisma } from "~/db/prisma";

/**
 * Pricing table keyed by model id. Prices are USD per token.
 *
 * Store the computed cost on the row so a later price change cannot silently
 * rewrite history. Update this map when models or pricing change.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-v4-flash": {
    input: 0.000_27 / 1_000,
    output: 0.001_1 / 1_000,
  },
};

export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return promptTokens * pricing.input + completionTokens * pricing.output;
}

export interface UsageSnapshot {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

/**
 * Shape returned by LangChain's `usage_metadata` on chat model responses.
 * Defined inline so we don't depend on LangChain internals.
 */
interface LangChainUsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

/**
 * Extract token counts from a LangChain chat model response.
 *
 * `@langchain/deepseek` populates `response.usage_metadata` when the
 * underlying API returns usage data. Falls back to zeros if absent.
 */
export function extractUsage(
  response: { usage_metadata?: LangChainUsageMetadata },
  fallbackPrompt = 0,
  fallbackCompletion = 0,
): { promptTokens: number; completionTokens: number } {
  const meta = response.usage_metadata;
  if (!meta) {
    return {
      promptTokens: fallbackPrompt,
      completionTokens: fallbackCompletion,
    };
  }
  return {
    promptTokens: meta.input_tokens ?? fallbackPrompt,
    completionTokens: meta.output_tokens ?? fallbackCompletion,
  };
}

export interface RecordUsageParams {
  endpoint: "draft-reply" | "suggest-review";
  stage: "sentiment" | "draft" | "suggest";
  model: string;
  usage: UsageSnapshot;
  ok: boolean;
  errorKind?: string;
  userId?: string | null;
  businessId?: string | null;
  reviewId?: string | null;
  ip?: string | null;
}

/**
 * Write a usage row off the request's critical path.
 *
 * Fire-and-forget: a ledger insert must never turn a working AI call into a
 * 500. Errors are logged and swallowed.
 */
export function recordUsage(params: RecordUsageParams): void {
  const {
    endpoint,
    stage,
    model,
    usage,
    ok,
    errorKind,
    userId,
    businessId,
    reviewId,
    ip,
  } = params;

  const cost = computeCost(model, usage.promptTokens, usage.completionTokens);

  // Off the critical path: do not await.
  prisma.aiUsage
    .create({
      data: {
        endpoint,
        stage,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        costUsd: cost,
        latencyMs: usage.latencyMs,
        ok,
        errorKind: errorKind ?? null,
        userId: userId ?? null,
        businessId: businessId ?? null,
        reviewId: reviewId ?? null,
        ip: ip ?? null,
      },
    })
    .catch((err) => {
      console.error("[ai-usage] failed to write ledger row:", err);
    });
}
