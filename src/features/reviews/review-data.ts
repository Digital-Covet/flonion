import {
  Clock3,
  MessageSquareText,
  Star,
  type LucideProps,
} from "lucide-solid";
import type {
  Metric,
  ReviewSource,
  ReviewSuggestion,
  TrendPoint,
} from "./review-types";
import type { Component } from "solid-js";

const reviewIcon: Component<LucideProps> = MessageSquareText;
const starIcon: Component<LucideProps> = Star;
const pendingIcon: Component<LucideProps> = Clock3;

export const metrics: Metric[] = [
  {
    label: "Total Reviews",
    value: "4,289",
    trend: "12.5%",
    trendDirection: "positive",
    icon: reviewIcon,
  },
  {
    label: "Avg Rating",
    value: "4.8",
    trend: "0.2",
    trendDirection: "positive",
    icon: starIcon,
  },
  {
    label: "Pending Replies",
    value: "124",
    trend: "5%",
    trendDirection: "negative",
    icon: pendingIcon,
  },
];

export const reviewSources: ReviewSource[] = [
  { name: "Google", percentage: 55, color: "primary" },
  { name: "Yelp", percentage: 30, color: "info" },
  { name: "Facebook", percentage: 15, color: "purple" },
];

export const initialSuggestions: ReviewSuggestion[] = [
  {
    id: "simple",
    tone: "Simple",
    text: "The meal wasn't good. It needed more heat.",
  },
  {
    id: "professional",
    tone: "Professional",
    text: "I was disappointed with the dish; it fell short of expectations and lacked the expected spice level.",
  },
];

export const sentimentTrend: TrendPoint[] = [
  { date: "1 Jul", positive: 50, negative: 25 },
  { date: "2 Jul", positive: 62, negative: 20 },
  { date: "3 Jul", positive: 55, negative: 32 },
  { date: "4 Jul", positive: 78, negative: 16 },
  { date: "5 Jul", positive: 85, negative: 25 },
  { date: "6 Jul", positive: 68, negative: 20 },
  { date: "7 Jul", positive: 54, negative: 25 },
];
