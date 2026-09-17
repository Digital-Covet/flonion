import { ChatDeepSeek } from "@langchain/deepseek";

/**
 * Shared model factory. The model id was hardcoded in both agent files;
 * extracting it here means a price change or model upgrade touches one line.
 *
 * The temperature differs per agent — sentiment analysis uses 0 (deterministic),
 * draft reply uses 0.7 (creative). Callers pass their own temperature.
 */
const MODEL_ID = process.env.AI_MODEL_ID ?? "deepseek-v4-flash";

export function getModel(apiKey: string, temperature = 0): ChatDeepSeek {
  return new ChatDeepSeek({
    model: MODEL_ID,
    temperature,
    apiKey,
  });
}

export { MODEL_ID as AI_MODEL_ID };

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
