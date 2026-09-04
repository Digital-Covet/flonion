interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

let cleanupStarted = false;
function ensureCleanupRunning() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Best-effort client address for rate-limit keys.
 *
 * Trusts `x-forwarded-for` because this app runs behind a proxy that sets it.
 * A client can forge the header, so never use this for authorization -- only to
 * spread limits across callers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  ensureCleanupRunning();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
