/**
 * better-auth answers several unrelated failures with HTTP 403: an unverified
 * email, but also an untrusted `Origin`, a `callbackURL` outside
 * `trustedOrigins`, and the other CSRF/redirect checks. Branching on the
 * status alone told verified users to resend a verification email when the
 * real problem was origin configuration, so callers branch on the code.
 */
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

/** Carries better-auth's error code alongside the message shown to the user. */
export class AuthError extends Error {
  readonly code: string | null;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = "AuthError";
    this.code = code ?? null;
  }
}

/** Reads the message off whatever `authClient` returned, without trusting its shape. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}

/** Reads the code off whatever `authClient` returned, without trusting its shape. */
export function authErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Rate-limit / lockout detection across better-auth's shapes (429 status,
 * TOO_MANY_REQUESTS / RATE_LIMIT codes, "too many attempts" / locked-until
 * messages). Callers map this to a "wait and retry" state instead of a
 * generic failure (spec §6: rate-limit/lockout states).
 */
export function isRateLimitError(error: unknown): boolean {
  const err = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
  } | null;
  if (!err || typeof err !== "object") return false;
  if (err.status === 429 || err.statusCode === 429) return true;
  const code = typeof err.code === "string" ? err.code : "";
  if (/RATE_LIMIT|TOO_MANY|LOCKED|LOCKOUT/i.test(code)) return true;
  const message = typeof err.message === "string" ? err.message : "";
  return /too many|rate.?limit|429|try again (later|in)|locked until|locked/i.test(
    message,
  );
}

export const RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a minute and try again.";
