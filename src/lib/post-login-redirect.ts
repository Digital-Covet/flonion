/**
 * Where to send someone once authentication finishes.
 *
 * Two hops need this. /login reads `?callbackURL=`, and the two-factor
 * challenge needs that same target once the second factor is verified — but
 * better-auth's `twoFactorPage` option redirects with a bare
 * `window.location.href = "/2fa"`, so the query string is gone by the time
 * /2fa renders. The destination is parked in sessionStorage just before
 * sign-in instead, and picked up on the other side.
 *
 * Every value is validated on read rather than on write: these end up in
 * `navigate()`, so an absolute URL, a protocol-relative "//evil.com", or a
 * backslash-smuggled variant must never pass.
 *
 * Both storage helpers bail out on the server. `window` is undefined there,
 * but `sessionStorage` is not: Node ships a Web Storage global, so a stray
 * server-side call would quietly succeed against a store shared by every
 * request in the process — one visitor's destination handed to the next.
 * The `isServer` guard is what prevents that; the try/catch only covers the
 * browser cases (private mode, a blocked storage partition).
 */
import { isServer } from "solid-js/web";

const DEFAULT_DESTINATION = "/dashboard";

const STORAGE_KEY = "flonion.post-2fa-destination";

/** Sending someone back into the auth funnel would just loop them. */
const AUTH_PATHS = new Set(["/login", "/signup", "/2fa", "/verify-email"]);

export function safeRedirectPath(
  raw: string | string[] | null | undefined,
  fallback: string = DEFAULT_DESTINATION,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  // Windows-style separators are normalised by some parsers, so "/\evil.com"
  // can escape the origin the same way "//" does.
  if (value.includes("\\")) return fallback;
  const [pathname] = value.split(/[?#]/, 1);
  if (AUTH_PATHS.has(pathname)) return fallback;
  return value;
}

/** Called just before sign-in, because a 2FA challenge redirects immediately. */
export function stashTwoFactorDestination(path: string): void {
  if (isServer) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Private mode or a blocked storage partition. /2fa then falls back to
    // the dashboard, which is never wrong — only less specific.
  }
}

/**
 * Reads and clears the parked destination. Called at the moment of a
 * successful verification, not on page load: a refresh of /2fa would
 * otherwise silently downgrade the target to the dashboard.
 */
export function takeTwoFactorDestination(
  fallback: string = DEFAULT_DESTINATION,
): string {
  if (isServer) return fallback;
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return safeRedirectPath(value, fallback);
  } catch {
    return fallback;
  }
}
