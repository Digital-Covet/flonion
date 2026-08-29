/**
 * Helpers for carrying an invitation token across the sign-up funnel.
 *
 * A signed-out invitee is bounced through /login and /signup before they can
 * accept, and a brand-new account also has to round-trip through email
 * verification. Every one of those hops used to drop the token, leaving the
 * onboarding page's email lookup as the only thing that reconnected them with
 * their invitation.
 *
 * These values end up in redirect targets, so the token is validated here —
 * once — rather than at each call site.
 */

/** `randomBytes(32).toString("hex")`, as issued by /api/team/invite. */
const INVITE_TOKEN_REGEX = /^[a-f0-9]{64}$/;

export function isInviteToken(value: string | null | undefined): value is string {
  return typeof value === "string" && INVITE_TOKEN_REGEX.test(value);
}

/**
 * Validates a raw `invite` search param. Takes the router's value rather than
 * reading `window`, so it resolves identically during SSR and hydration — a
 * window-only read renders the signed-out links without the token.
 */
export function pickInviteToken(raw: string | string[] | undefined): string | null {
  const token = Array.isArray(raw) ? raw[0] : raw;
  return isInviteToken(token) ? token : null;
}

/**
 * Where to send the user once they are authenticated. Always a relative path —
 * better-auth additionally validates callbackURL against `trustedOrigins`.
 */
export function inviteCallbackUrl(token: string | null, fallback: string): string {
  return isInviteToken(token) ? `/accept-invite?token=${token}` : fallback;
}

/** Keeps the token attached to the login <-> signup swap links. */
export function withInvite(path: string, token: string | null): string {
  return isInviteToken(token) ? `${path}?invite=${token}` : path;
}
