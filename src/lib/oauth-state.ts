import { randomToken, sign, verifySignature } from "./crypto";
import { expiredCookie, readCookie, serializeCookie } from "./cookies";

export const OAUTH_STATE_COOKIE = "goauth_state";

const STATE_TTL_MS = 10 * 60 * 1000;
const SIG_PURPOSE = "google-oauth-state";

/**
 * Paths the OAuth flow is allowed to return the user to. The return path
 * originates from a query parameter, so it is never interpolated anywhere
 * without passing through here first.
 */
const ALLOWED_RETURN_PREFIXES = [
  "/onboarding",
  "/settings",
  "/dashboard",
  "/account",
  "/reviews",
  "/marketing",
];

const SAFE_PATH = /^\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9=&_%-]*)?$/;

export function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/dashboard";
  if (!SAFE_PATH.test(value)) return "/dashboard";

  const path = value.split("?")[0]!;
  const allowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  return allowed ? value : "/dashboard";
}

interface StatePayload {
  nonce: string;
  returnTo: string;
  exp: number;
}

/**
 * Issues an opaque nonce for the `state` query parameter plus a signed
 * HttpOnly cookie holding the same nonce. Google echoes `state` back; the
 * callback only proceeds if it matches the cookie, which an attacker who
 * cannot set cookies on our origin is unable to forge.
 */
export function createOAuthState(returnTo: string): {
  state: string;
  cookie: string;
} {
  const nonce = randomToken(32);
  const payload: StatePayload = {
    nonce,
    returnTo: sanitizeReturnTo(returnTo),
    exp: Date.now() + STATE_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const value = `${encoded}.${sign(encoded, SIG_PURPOSE)}`;

  return {
    state: nonce,
    cookie: serializeCookie(OAUTH_STATE_COOKIE, value, {
      maxAge: Math.floor(STATE_TTL_MS / 1000),
    }),
  };
}

/**
 * Validates the echoed `state` against the cookie. Returns the sanitized
 * return path on success, or null if the flow should be rejected.
 */
export function consumeOAuthState(
  headers: Headers,
  stateParam: string | null,
): string | null {
  if (!stateParam) return null;

  const cookieValue = readCookie(headers, OAUTH_STATE_COOKIE);
  if (!cookieValue) return null;

  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encoded = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);
  if (!verifySignature(encoded, signature, SIG_PURPOSE)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (typeof payload.nonce !== "string" || payload.nonce !== stateParam) {
    return null;
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;

  return sanitizeReturnTo(payload.returnTo);
}

export function clearOAuthStateCookie(): string {
  return expiredCookie(OAUTH_STATE_COOKIE);
}
