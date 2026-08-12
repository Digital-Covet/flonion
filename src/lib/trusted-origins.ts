/**
 * Origins allowed to make state-changing requests to this app.
 *
 * Derived from environment rather than hardcoded so staging and production
 * do not need code changes. Localhost is only included outside production.
 */
export function getTrustedOrigins(): string[] {
  const origins = new Set<string>();

  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.VITE_APP_URL,
    process.env.APP_URL,
  ]) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed env values rather than failing app startup.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }

  return [...origins];
}

/**
 * Returns true when the request may proceed.
 *
 * A browser always sends `Origin` on cross-origin state-changing requests, so
 * a present-but-untrusted value is rejected. A missing `Origin` indicates a
 * non-browser client (server-to-server, native app), which CSRF does not apply
 * to, so it is allowed through.
 */
export function isTrustedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  return getTrustedOrigins().includes(origin);
}
