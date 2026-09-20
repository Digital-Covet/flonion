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
 * Raster types accepted in a stored `data:` image. SVG is excluded: it is a
 * document format, and the stored value is echoed into markup by the QR sheet
 * as well as into `<img src>`.
 */
const DATA_IMAGE_TYPES = ["png", "jpeg", "jpg", "gif", "webp", "avif"];

const DATA_IMAGE_RE = new RegExp(
  `^data:image/(${DATA_IMAGE_TYPES.join("|")});base64,[A-Za-z0-9+/]+={0,2}$`,
  "i",
);

/**
 * Ceiling on an inlined image, in characters of base64 (~3/4 as many bytes).
 * These columns are read back on every marketplace card and the public review
 * page, so an unbounded one is paid for by every reader.
 */
export const MAX_DATA_IMAGE_LENGTH = 2_000_000;

/**
 * Returns the value when it is safe to render in `<img src>`: an absolute
 * http(s) URL, or a bounded base64 `data:` image of a known raster type. Else
 * null.
 *
 * Logos and avatars are owner-supplied and rendered to every visitor, so an
 * unchecked string here is an arbitrary scheme, an unbounded payload, or an
 * off-origin tracker that fires on page load. The onboarding flow does inline
 * small images, so `data:` cannot simply be refused — it is bounded instead.
 * Mirrors `imageUrlError` in the company editor.
 */
export function imageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^data:/i.test(trimmed)) {
    if (trimmed.length > MAX_DATA_IMAGE_LENGTH) return null;
    return DATA_IMAGE_RE.test(trimmed) ? trimmed : null;
  }
  return httpUrl(trimmed);
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
