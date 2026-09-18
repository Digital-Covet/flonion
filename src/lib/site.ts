/**
 * Canonical site identity for SEO.
 *
 * `app.flonion.com` is the main host: it serves both the marketing pages and
 * the signed-in product, and it is what canonicals, Open Graph URLs, the
 * sitemap and structured data must point at. Any other host (for example
 * `flonion.com`) should redirect here; if it ever serves content directly, its
 * pages will already canonicalise to this origin.
 */
export const SITE_ORIGIN = "https://app.flonion.com";

/** 1.91:1 card, the width/height every major social crawler agrees on. */
export const DEFAULT_OG_IMAGE = "/og-flonion.png";
export const OG_IMAGE_WIDTH = "1200";
export const OG_IMAGE_HEIGHT = "630";
export const OG_IMAGE_ALT =
  "Flonion — more genuine reviews for local businesses";
export const OG_LOCALE = "en_IN";

/** Absolute URL for a root-relative path, resolved against the canonical origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
