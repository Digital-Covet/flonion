/**
 * Review platforms a business can send customers to. Shared by the onboarding
 * wizard, POST /api/business (link validation) and /api/reviews/track (which
 * only counts redirects to a known slug).
 */
export const REVIEW_PLATFORMS = [
  {
    slug: "google",
    label: "Google",
    placeholder: "https://g.page/r/…/review",
    help: "Open your Google Business Profile, choose “Ask for reviews”, and copy the link it gives you.",
  },
  {
    slug: "justdial",
    label: "JustDial",
    placeholder: "https://www.justdial.com/…",
    help: "Search for your business on justdial.com, open your listing, and copy the address from the browser bar.",
  },
  {
    slug: "facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/yourpage/reviews",
    help: "Open your Facebook Page, go to the Reviews tab, and copy the page address.",
  },
  {
    slug: "tripadvisor",
    label: "Tripadvisor",
    placeholder: "https://www.tripadvisor.in/…",
    help: "Open your listing on Tripadvisor, choose “Write a review”, and copy the address of that page.",
  },
  {
    slug: "yelp",
    label: "Yelp",
    placeholder: "https://www.yelp.com/writeareview/biz/…",
    help: "Open your business page on Yelp, choose “Write a review”, and copy the address of that page.",
  },
] as const;

export type ReviewPlatformSlug = (typeof REVIEW_PLATFORMS)[number]["slug"];

export type ReviewLinksMap = Partial<Record<ReviewPlatformSlug, string>>;

export function isReviewPlatformSlug(
  value: string,
): value is ReviewPlatformSlug {
  return REVIEW_PLATFORMS.some((p) => p.slug === value);
}

/** Display name for a slug; `custom` overrides the built-in labels. */
export function getPlatformLabel(
  slug: string,
  custom: Record<string, string>,
): string {
  return (
    custom[slug] ?? REVIEW_PLATFORMS.find((p) => p.slug === slug)?.label ?? slug
  );
}
