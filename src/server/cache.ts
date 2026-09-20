type Entry<T> = { value: T; expires: number };

export type TtlCache<T> = {
  /** Read-through. Concurrent callers share one load; a throw is never cached. */
  get(key: string, load: () => Promise<T>): Promise<T>;
  delete(key: string): void;
  deleteByPrefix(prefix: string): void;
  clear(): void;
};

/**
 * A small in-process read-through cache.
 *
 * Per-process by design: with several instances each pays its own cold load
 * once per TTL window, and an explicit invalidation only reaches the instance
 * that ran it. Every value cached through this must therefore be safe to serve
 * up to `ttlMs` stale. Nothing user-scoped may be cached without the user in
 * the key.
 */
export function createTtlCache<T>(opts: {
  name: string;
  ttlMs: number;
  /** Shorter life for empty results, which are more likely to change soon. */
  negativeTtlMs?: number;
  max?: number;
}): TtlCache<T> {
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  const ttlFor = (value: T) =>
    value == null && opts.negativeTtlMs != null
      ? opts.negativeTtlMs
      : opts.ttlMs;

  return {
    async get(key, load) {
      const hit = entries.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;

      const pending = inflight.get(key);
      if (pending) return pending;

      const p = load()
        .then((value) => {
          entries.set(key, { value, expires: Date.now() + ttlFor(value) });
          if (opts.max && entries.size > opts.max) {
            // Insertion order: drop the oldest key.
            const oldest = entries.keys().next();
            if (!oldest.done) entries.delete(oldest.value);
          }
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, p);
      return p;
    },

    delete(key) {
      entries.delete(key);
      inflight.delete(key);
    },

    deleteByPrefix(prefix) {
      for (const k of [...entries.keys()]) {
        if (k.startsWith(prefix)) entries.delete(k);
      }
      for (const k of [...inflight.keys()]) {
        if (k.startsWith(prefix)) inflight.delete(k);
      }
    },

    clear() {
      entries.clear();
      inflight.clear();
    },
  };
}
