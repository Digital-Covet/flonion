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
 * Upper bound on tracked keys. Every forged address used to add an entry that
 * lived until the next sweep; past this size expired entries are swept inline,
 * and if that is not enough the oldest entries are dropped.
 */
const MAX_ENTRIES = 50_000;

/**
 * The one header the edge proxy sets, and must *overwrite* on every inbound
 * request. Never a chain: counting hops into `x-forwarded-for` only selects the
 * real client when the deployed topology happens to match the count, and picks
 * an attacker-chosen entry when it does not.
 *
 * `betterAuth` is configured with the same header name, so both rate limiters
 * on this origin agree about who the client is.
 */
export const CLIENT_IP_HEADER = (
  process.env.CLIENT_IP_HEADER ?? "x-real-ip"
).toLowerCase();

let warnedAboutMissingHeader = false;

/**
 * Best-effort client address for rate-limit keys.
 *
 * Returns `"unknown"` when the trusted header is absent or carries a chain,
 * which buckets those callers together rather than handing each request a
 * fresh bucket. Never use this for authorization -- only to spread limits
 * across callers.
 */
export function getClientIp(request: Request): string {
  const value = request.headers.get(CLIENT_IP_HEADER)?.trim();

  // A comma means something upstream is appending rather than overwriting, so
  // the value is not attributable to one client. Treat it as unknown instead
  // of guessing which entry is real.
  if (value && !value.includes(",")) return value;

  if (!warnedAboutMissingHeader) {
    warnedAboutMissingHeader = true;
    console.warn(
      `[rate-limit] No usable "${CLIENT_IP_HEADER}" header on an inbound request. ` +
        "Per-IP limits collapse into a single shared bucket until the proxy sets it " +
        "(or CLIENT_IP_HEADER names the header it does set).",
    );
  }

  return "unknown";
}

function enforceStoreBound(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
  // Map iteration is insertion order, so this drops the oldest windows first.
  for (const key of store.keys()) {
    if (store.size < MAX_ENTRIES) break;
    store.delete(key);
  }
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
    enforceStoreBound(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}
