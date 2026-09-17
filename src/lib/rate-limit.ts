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

function trustedProxyHops(): number {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(hops) && hops >= 1 ? hops : 1;
}

/**
 * Best-effort client address for rate-limit keys.
 *
 * Proxies append the address they received the connection from, so the
 * leftmost `x-forwarded-for` entries are whatever the client sent. The client
 * is the entry `TRUSTED_PROXY_HOPS` places from the right (default 1: a single
 * proxy in front of the app). Never use this for authorization -- only to
 * spread limits across callers.
 */
export function getClientIp(request: Request): string {
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    chain[chain.length - trustedProxyHops()] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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
