import type { UsageMeta } from "./ledger";
import { draftReviewReply, suggestImprovedReview } from "./review-drafter";
import { analyzeSentiment, type SentimentAnalysis } from "./sentiment-analyzer";

export interface ReviewPipelineResult {
  sentiment: SentimentAnalysis;
  draft: string;
  /** Accumulated usage from both stages (sentiment + draft). */
  usage: UsageMeta[];
}

export async function runReviewPipeline(params: {
  comment: string;
  starRating: number;
  reviewerName?: string;
  tone?: "professional" | "friendly" | "formal";
  apiKey: string;
}): Promise<ReviewPipelineResult> {
  const sentimentResult = await analyzeSentiment({
    comment: params.comment,
    starRating: params.starRating,
    apiKey: params.apiKey,
  });

  const draftResult = await draftReviewReply({
    comment: params.comment,
    starRating: params.starRating,
    reviewerName: params.reviewerName || "valued customer",
    sentiment: sentimentResult.analysis,
    tone: params.tone,
    apiKey: params.apiKey,
  });

  return {
    sentiment: sentimentResult.analysis,
    draft: draftResult.draftReply,
    usage: [sentimentResult.usage, draftResult.usage],
  };
}

export interface SuggestionPipelineResult {
  sentiment: SentimentAnalysis;
  suggestedReviews: string[];
  /** Accumulated usage from both stages (sentiment + suggestion). */
  usage: UsageMeta[];
}

export async function runSuggestionPipeline(params: {
  draftText: string;
  starRating: number;
  keywords?: string;
  businessName?: string;
  apiKey: string;
}): Promise<SuggestionPipelineResult> {
  const hasText = params.draftText.trim().length > 0;

  const sentimentResult = await analyzeSentiment({
    comment: hasText ? params.draftText : "",
    starRating: params.starRating,
    apiKey: params.apiKey,
  });

  const suggestionResult = await suggestImprovedReview({
    draftText: params.draftText,
    starRating: params.starRating,
    sentiment: sentimentResult.analysis,
    keywords: params.keywords,
    businessName: params.businessName,
    apiKey: params.apiKey,
  });

  return {
    sentiment: sentimentResult.analysis,
    suggestedReviews: suggestionResult.suggestedReviews,
    usage: [sentimentResult.usage, suggestionResult.usage],
  };
}
