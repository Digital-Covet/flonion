import {
  CUSTOM_LABEL_KEY,
  REVIEW_PLATFORMS,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";

const MAX_URL_LENGTH = 2048;
const MAX_LABEL_LENGTH = 60;

const PLATFORM_SLUGS = new Set(REVIEW_PLATFORMS.map((p) => p.slug));

/**
 * Returns the URL normalized if it is an absolute http(s) URL, otherwise null.
 *
 * Owner-supplied links are navigated to on the public review page, so a
 * `javascript:` or `data:` value would run script on this app's origin.
 */
export function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type SanitizedReviewLinks =
  | { ok: true; links: ReviewLinksMap }
  | { ok: false; slug: string };

/**
 * Keeps only known platform slugs plus the custom label for the "other"
 * platform. An empty value is kept (the settings page stores enabled-but-unset
 * platforms that way); any other value must be an http(s) URL.
 */
export function sanitizeReviewLinks(value: object): SanitizedReviewLinks {
  const links: ReviewLinksMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === CUSTOM_LABEL_KEY) {
      if (typeof raw === "string" && raw.trim()) {
        links[key] = raw.trim().slice(0, MAX_LABEL_LENGTH);
      }
      continue;
    }
    if (!PLATFORM_SLUGS.has(key)) continue;
    if (raw === "" || raw === null || raw === undefined) {
      links[key] = "";
      continue;
    }
    const url = httpUrl(raw);
    if (!url) return { ok: false, slug: key };
    links[key] = url;
  }
  return { ok: true, links };
}
