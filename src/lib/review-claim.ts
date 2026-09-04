import { sign, verifySignature } from "./crypto";

/**
 * Capability token proving the bearer created a given SharedReview row.
 *
 * The public review page creates an empty row on mount and fills it in when the
 * visitor submits, so the update-by-id path has to stay open to anonymous
 * callers. Without a token that made every published review writable by anyone
 * who knew its id. The token is handed back only to the caller that created the
 * row, so a visitor can finish their own submission and nobody else's.
 */

const SIG_PURPOSE = "shared-review-claim";
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

export function issueReviewClaim(reviewId: string): string {
  const exp = Date.now() + CLAIM_TTL_MS;
  const encoded = Buffer.from(`${reviewId}.${exp}`).toString("base64url");
  return `${encoded}.${sign(encoded, SIG_PURPOSE)}`;
}

export function verifyReviewClaim(
  token: unknown,
  reviewId: string,
): boolean {
  if (typeof token !== "string" || !token) return false;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!verifySignature(encoded, signature, SIG_PURPOSE)) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64url").toString("utf-8");
  } catch {
    return false;
  }

  const separator = decoded.lastIndexOf(".");
  if (separator === -1) return false;

  const claimedId = decoded.slice(0, separator);
  const exp = Number(decoded.slice(separator + 1));

  if (claimedId !== reviewId) return false;
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  return true;
}
