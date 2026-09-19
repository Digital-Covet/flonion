/**
 * Product feedback (spec §6, Feedback): the short form at `/feedback` and
 * `POST /api/feedback` validate against the same list, so the page can never
 * offer a category the endpoint would reject.
 */
export const FEEDBACK_CATEGORIES = [
  "General",
  "Bug Report",
  "Feature Request",
  "Improvement",
  "Other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === "string" &&
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Length caps. The form enforces them with `maxlength` and a counter; the
 * endpoint enforces the same numbers, because `maxlength` is a hint to a
 * browser and not a constraint on a request.
 */
export const FEEDBACK_NAME_MAX = 100;
export const FEEDBACK_EMAIL_MAX = 254;
export const FEEDBACK_MESSAGE_MAX = 2000;
