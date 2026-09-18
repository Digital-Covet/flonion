/**
 * Field rules for the business form, shared by the onboarding wizard and the
 * Settings page. Both write to `POST /api/business`, so a rule that lives in
 * only one of them means onboarding accepts what Settings rejects (or the
 * other way round). The server re-validates everything here — this copy exists
 * to name the problem in the field, not to be the gate.
 */

/** Sector choices offered in onboarding and Settings; stored free-text. */
export const SECTORS = [
  "Restaurant & café",
  "Salon & spa",
  "Clinic & healthcare",
  "Retail store",
  "Hotel & stay",
  "Fitness & wellness",
  "Education & coaching",
  "Home services",
  "Automotive",
  "Real estate",
  "Professional services",
  "Other",
];

export const USERNAME_MAX = 15;
export const DESCRIPTION_MAX = 280;
export const KEYWORDS_MAX = 10;
export const KEYWORD_MAX_LENGTH = 40;
export const BUSINESS_NAME_MAX = 100;

const USERNAME_RE = /^[a-z0-9-]+$/;

/** Mirrors the username checks in `src/routes/api/business.ts`. */
export function usernameProblem(value: string): string | null {
  if (value.length > USERNAME_MAX)
    return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!USERNAME_RE.test(value))
    return "Use lowercase letters, numbers, and hyphens only.";
  return null;
}

export function phoneProblem(value: string): string | null {
  if (!value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (
    !/^[+\d\s()-]+$/.test(value.trim()) ||
    digits.length < 7 ||
    digits.length > 15
  )
    return "Enter a phone number like +91 98765 43210.";
  return null;
}

/**
 * Review links are navigated to from the public review page, so only http(s)
 * is accepted — `sanitizeReviewLinks` rejects the rest server-side.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Keywords are stored as one comma-separated string on the business row. */
export function splitKeywordList(value: string): string[] {
  return value
    .split(",")
    .map((k) => k.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}
