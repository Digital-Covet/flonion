import { Effect, Schema } from "effect";
import { decodeModelJson, LlmModel } from "~/server/effect/services/llm";
import type { SentimentAnalysis } from "~/types/ai";
import type { UsageMeta } from "./ledger";

export type { SentimentAnalysis } from "~/types/ai";

/** What the model must answer; anything else is an `LlmError`. */
const SentimentAnalysisSchema = Schema.Struct({
  overallSentiment: Schema.Literals([
    "positive",
    "negative",
    "neutral",
    "mixed",
  ]),
  sentimentScore: Schema.Number.pipe(
    Schema.check(Schema.isBetween({ minimum: -1, maximum: 1 })),
  ),
  sentimentWords: Schema.Array(
    Schema.Struct({
      word: Schema.String,
      category: Schema.Literals([
        "praise",
        "complaint",
        "suggestion",
        "emotion",
      ]),
      intensity: Schema.Literals(["low", "medium", "high"]),
    }),
  ),
  keyTopics: Schema.Array(Schema.String),
  customerIntent: Schema.Literals([
    "complaint",
    "compliment",
    "suggestion",
    "question",
  ]),
});

export interface SentimentResult {
  analysis: SentimentAnalysis;
  usage: UsageMeta;
}

/** A rating-only review gets its sentiment from the stars, without the model. */
function fromStarsOnly(starRating: number): SentimentResult {
  return {
    analysis: {
      overallSentiment:
        starRating >= 4 ? "positive" : starRating <= 2 ? "negative" : "neutral",
      sentimentScore: starRating >= 4 ? 0.7 : starRating <= 2 ? -0.6 : 0.0,
      sentimentWords: [],
      keyTopics: [],
      customerIntent: starRating >= 4 ? "compliment" : "complaint",
    },
    usage: { promptTokens: 0, completionTokens: 0, model: "none" },
  };
}

export const analyzeSentiment = Effect.fn("analyzeSentiment")(
  function* (params: { comment: string; starRating: number }) {
    if (!params.comment.trim()) return fromStarsOnly(params.starRating);

    const starContext =
      params.starRating <= 2
        ? "This is a low-rated review, likely negative."
        : params.starRating >= 4
          ? "This is a high-rated review, likely positive."
          : "This is a mid-rated review, sentiment may be mixed.";

    const llm = yield* LlmModel;
    const { text, usage } = yield* llm.complete({
      // Deterministic: the same review should always read the same way.
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a sentiment analysis expert for customer reviews.

${starContext}

Analyze the review and return ONLY valid JSON.

The JSON must match this structure:

{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": number,
  "sentimentWords": [
    {
      "word": string,
      "category": "praise|complaint|suggestion|emotion",
      "intensity": "low|medium|high"
    }
  ],
  "keyTopics": [string],
  "customerIntent": "complaint|compliment|suggestion|question"
}

Do not wrap the JSON in markdown.
Do not output any explanation.`,
        },
        {
          role: "user",
          content: `Review (star rating: ${params.starRating}/5):

"${params.comment}"`,
        },
      ],
    });

    const analysis = yield* decodeModelJson(SentimentAnalysisSchema)(text);
    return {
      analysis: analysis as SentimentAnalysis,
      usage,
    } satisfies SentimentResult;
  },
);
