/*
 * The model itself is the `LlmModel` service
 * (`src/server/effect/services/llm.ts`), which reads `AI_MODEL_ID`.
 */

/**
 * Pricing map keyed by model id. Prices are per million tokens.
 * A later price change does not silently rewrite history because the
 * cost is computed and stored on the row at write time.
 */
export const MODEL_PRICING: Record<
  string,
  { prompt: number; completion: number }
> = {
  "deepseek-v4-flash": { prompt: 0.27, completion: 1.1 },
  "deepseek-chat": { prompt: 0.14, completion: 0.28 },
};

export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (
    (promptTokens * pricing.prompt + completionTokens * pricing.completion) /
    1_000_000
  );
}
