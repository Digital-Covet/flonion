/**
 * Deadlines for outbound calls.
 *
 * `fetch` has no default timeout, so a hung upstream connection holds a
 * request handler open indefinitely. That compounds where a cache shares one
 * in-flight promise across callers: one wedged call wedges every later caller
 * for that key until the connection eventually drops.
 */

/** Ceiling on a single upstream request. */
export const OUTBOUND_TIMEOUT_MS = 10_000;

/**
 * `fetch` with a deadline. `AbortSignal.timeout` rejects with a `TimeoutError`
 * `DOMException`, which every caller here already treats as an upstream
 * failure.
 *
 * An explicit `signal` in `init` wins, so a caller with its own cancellation
 * story keeps it.
 */
export function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs: number = OUTBOUND_TIMEOUT_MS,
): Promise<Response> {
  return fetch(input, {
    signal: AbortSignal.timeout(timeoutMs),
    ...init,
  });
}
