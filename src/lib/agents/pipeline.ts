import { Effect } from "effect";
import type { SentimentAnalysis } from "~/types/ai";
import type { UsageMeta } from "./ledger";
import { draftReviewReply, suggestImprovedReview } from "./review-drafter";
import { analyzeSentiment } from "./sentiment-analyzer";

export interface ReviewPipelineResult {
  sentiment: SentimentAnalysis;
  draft: string;
  /** Accumulated usage from both stages (sentiment + draft). */
  usage: UsageMeta[];
}

/** Sentiment first, then a reply drafted from it. */
export const runReviewPipeline = Effect.fn("runReviewPipeline")(
  function* (params: {
    comment: string;
    starRating: number;
    reviewerName?: string;
    tone?: "professional" | "friendly" | "formal";
  }) {
    const sentiment = yield* analyzeSentiment({
      comment: params.comment,
      starRating: params.starRating,
    });

    const draft = yield* draftReviewReply({
      comment: params.comment,
      starRating: params.starRating,
      reviewerName: params.reviewerName || "valued customer",
      sentiment: sentiment.analysis,
      tone: params.tone,
    });

    return {
      sentiment: sentiment.analysis,
      draft: draft.draftReply,
      usage: [sentiment.usage, draft.usage],
    } satisfies ReviewPipelineResult;
  },
);

export interface SuggestionPipelineResult {
  sentiment: SentimentAnalysis;
  suggestedReviews: string[];
  /** Accumulated usage from both stages (sentiment + suggestion). */
  usage: UsageMeta[];
}

/** Sentiment first, then three improved versions of the draft. */
export const runSuggestionPipeline = Effect.fn("runSuggestionPipeline")(
  function* (params: {
    draftText: string;
    starRating: number;
    keywords?: string;
    businessName?: string;
  }) {
    const hasText = params.draftText.trim().length > 0;

    const sentiment = yield* analyzeSentiment({
      comment: hasText ? params.draftText : "",
      starRating: params.starRating,
    });

    const suggestion = yield* suggestImprovedReview({
      draftText: params.draftText,
      starRating: params.starRating,
      sentiment: sentiment.analysis,
      keywords: params.keywords,
      businessName: params.businessName,
    });

    return {
      sentiment: sentiment.analysis,
      suggestedReviews: [...suggestion.suggestedReviews],
      usage: [sentiment.usage, suggestion.usage],
    } satisfies SuggestionPipelineResult;
  },
);
