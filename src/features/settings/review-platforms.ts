export interface ReviewPlatform {
  slug: string;
  label: string;
  placeholder: string;
  color: string;
  isCustom?: boolean;
}

export const REVIEW_PLATFORMS: ReviewPlatform[] = [
  {
    slug: "google",
    label: "Google",
    placeholder: "https://search.google.com/local/writereview?placeid=...",
    color: "#4285F4",
  },
  {
    slug: "justdial",
    label: "JustDial",
    placeholder: "https://www.justdial.com/..." ,
    color: "#F57224",
  },
  {
    slug: "yelp",
    label: "Yelp",
    placeholder: "https://www.yelp.com/writeareview/biz/...",
    color: "#FF1A1A",
  },
  {
    slug: "facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/.../reviews",
    color: "#1877F2",
  },
  {
    slug: "tripadvisor",
    label: "TripAdvisor",
    placeholder: "https://www.tripadvisor.com/...",
    color: "#34E0A1",
  },
  {
    slug: "other",
    label: "Other",
    placeholder: "https://...",
    color: "#6B7280",
    isCustom: true,
  },
];

export function getPlatformBySlug(slug: string): ReviewPlatform | undefined {
  return REVIEW_PLATFORMS.find((p) => p.slug === slug);
}

export const CUSTOM_LABEL_KEY = "_customLabel";

export function getPlatformLabel(
  slug: string,
  reviewLinks: ReviewLinksMap,
): string {
  if (slug === "other" && reviewLinks[CUSTOM_LABEL_KEY]) {
    return reviewLinks[CUSTOM_LABEL_KEY];
  }
  return getPlatformBySlug(slug)?.label ?? slug;
}

export type ReviewLinksMap = Record<string, string>;
