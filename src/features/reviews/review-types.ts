import type { Component } from "solid-js";
import type { LucideProps } from "lucide-solid";

export type Rating = 1 | 2 | 3 | 4 | 5;

export type MetricTrend = "positive" | "negative";

export interface Metric {
  label: string;
  value: string;
  trend: string;
  trendDirection: MetricTrend;
  icon: Component<LucideProps>;
}

export type SourceColor = "primary" | "info" | "purple";

export interface ReviewSource {
  name: string;
  percentage: number;
  color: SourceColor;
}

export type SuggestionTone = "Simple" | "Professional" | "Casual";

export interface ReviewSuggestion {
  id: string;
  tone: SuggestionTone;
  text: string;
  recommended?: boolean;
}

export interface TrendPoint {
  date: string;
  positive: number;
  negative: number;
}

export interface ReviewDraft {
  rating: Rating;
  text: string;
}

export interface SharedReview {
  id: string;
  text: string;
  rating: Rating;
  createdAt: string;
  reviewerName?: string;
  keywords?: string;
}
