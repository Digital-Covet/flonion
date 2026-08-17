export const FEEDBACK_CATEGORIES = [
  "General",
  "Bug Report",
  "Feature Request",
  "Improvement",
  "Other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackFormData {
  name: string;
  email: string;
  category: FeedbackCategory | "";
  rating: number;
  message: string;
}

export interface FeedbackSubmissionResponse {
  id?: string;
  success?: boolean;
  error?: string;
}
