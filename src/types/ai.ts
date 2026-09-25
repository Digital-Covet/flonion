/** What the sentiment stage reports about a review. Shared with the UI. */
export interface SentimentAnalysis {
  overallSentiment: "positive" | "negative" | "neutral" | "mixed";
  /** -1 (very negative) to 1 (very positive). */
  sentimentScore: number;
  sentimentWords: Array<{
    word: string;
    category: "praise" | "complaint" | "suggestion" | "emotion";
    intensity: "low" | "medium" | "high";
  }>;
  keyTopics: string[];
  customerIntent: "complaint" | "compliment" | "suggestion" | "question";
}
