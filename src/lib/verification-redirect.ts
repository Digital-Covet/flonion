/**
 * Recovering from a bad sign-up confirmation link.
 *
 * better-auth's `/api/auth/verify-email` reports a failure by appending
 * `?error=<code>` to the callbackURL — the same URL it sends a successful
 * verification to. /signup and /verify-email use `/onboarding`, or
 * `/accept-invite?token=…` for an invitee, so a signed-out visitor with an
 * expired link would land on a page that either bounces them to /login or
 * ignores the error. The middleware uses this to send them to /verify-email,
 * where they can get a new link.
 */
import { pickInviteToken } from "./invite-redirect";

/** The codes `verify-email` redirects with for a sign-up link. */
export const VERIFY_LINK_ERRORS = [
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "USER_NOT_FOUND",
] as const;

export type VerifyLinkError = (typeof VERIFY_LINK_ERRORS)[number];

export function pickVerifyLinkError(
  raw: string | string[] | null | undefined,
): VerifyLinkError | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return VERIFY_LINK_ERRORS.find((code) => code === value) ?? null;
}

/**
 * The /verify-email URL for a failed confirmation link, or null when `url`
 * isn't one. Only the callbacks sign-up uses count: `/account` carries
 * change-email failures, which a new sign-up link can't fix.
 */
export function verificationErrorRedirect(url: URL): string | null {
  const error = pickVerifyLinkError(url.searchParams.get("error"));
  if (!error) return null;

  let invite: string | null = null;
  if (url.pathname === "/accept-invite") {
    invite = pickInviteToken(url.searchParams.get("token") ?? undefined);
    // Without a valid token this was never a sign-up callback.
    if (!invite) return null;
  } else if (url.pathname !== "/onboarding") {
    return null;
  }

  const params = new URLSearchParams({ error });
  if (invite) params.set("invite", invite);
  return `/verify-email?${params}`;
}
