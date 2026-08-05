import { analyzeSentiment, type SentimentAnalysis } from "./sentiment-analyzer";
import { draftReviewReply, suggestImprovedReview, type DraftReplyResult } from "./review-drafter";

export interface ReviewPipelineResult {
  sentiment: SentimentAnalysis;
  draft: string;
}

export async function runReviewPipeline(params: {
  comment: string;
  starRating: number;
  reviewerName?: string;
  tone?: "professional" | "friendly" | "formal";
  apiKey: string;
}): Promise<ReviewPipelineResult> {
  const sentiment = await analyzeSentiment({
    comment: params.comment,
    starRating: params.starRating,
    apiKey: params.apiKey,
  });

  const draftResult = await draftReviewReply({
    comment: params.comment,
    starRating: params.starRating,
    reviewerName: params.reviewerName || "valued customer",
    sentiment,
    tone: params.tone,
    apiKey: params.apiKey,
  });

  return {
    sentiment,
    draft: draftResult.draftReply,
  };
}

export interface SuggestionPipelineResult {
  sentiment: SentimentAnalysis;
  suggestedReviews: string[];
}

export async function runSuggestionPipeline(params: {
  draftText: string;
  starRating: number;
  keywords?: string;
  apiKey: string;
}): Promise<SuggestionPipelineResult> {
  const sentiment = await analyzeSentiment({
    comment: params.draftText,
    starRating: params.starRating,
    apiKey: params.apiKey,
  });

  const suggestionResult = await suggestImprovedReview({
    draftText: params.draftText,
    starRating: params.starRating,
    sentiment,
    keywords: params.keywords,
    apiKey: params.apiKey,
  });

  return {
    sentiment,
    suggestedReviews: suggestionResult.suggestedReviews,
  };
}
