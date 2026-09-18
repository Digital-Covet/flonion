import {
  isReviewPlatformSlug,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";

/**
 * Returns the normalised URL when `value` is an absolute http(s) URL, else
 * null. Anything stored here is later navigated to, so `javascript:` and
 * friends must never pass.
 */
export function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Keeps known platform slugs with a valid http(s) link and drops blanks and
 * unknown keys. The first invalid non-blank link fails the whole map so the
 * caller can name the platform back to the user.
 */
export function sanitizeReviewLinks(
  input: object,
): { ok: true; links: ReviewLinksMap } | { ok: false; slug: string } {
  const links: ReviewLinksMap = {};
  for (const [slug, raw] of Object.entries(input)) {
    if (!isReviewPlatformSlug(slug)) continue;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const safe = httpUrl(raw);
    if (!safe) return { ok: false, slug };
    links[slug] = safe;
  }
  return { ok: true, links };
}
