/**
 * better-auth answers several unrelated failures with HTTP 403: an unverified
 * email, but also an untrusted `Origin`, a `callbackURL` outside
 * `trustedOrigins`, and the other CSRF/redirect checks. Branching on the
 * status alone told verified users to resend a verification email when the
 * real problem was origin configuration, so callers branch on the code.
 */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** Carries better-auth's error code alongside the message shown to the user. */
export class AuthError extends Error {
  readonly code: string | null;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = 'AuthError';
    this.code = code ?? null;
  }
}

/** Reads the code off whatever `authClient` returned, without trusting its shape. */
export function authErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}
