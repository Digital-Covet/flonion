import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Server-only. Import this from `src/routes/api/**` and never from a
 * component: it reads the Cashfree secret. The API client itself is the
 * `Cashfree` service in `src/server/effect/services/cashfree.ts`.
 */

/**
 * Pinned rather than left to the SDK default, because the subscription and
 * webhook shapes this code reads are the ones documented for this version.
 * Set the same version on the Cashfree dashboard's webhook.
 */
export const CASHFREE_API_VERSION = "2025-01-01";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[payments] ${name} is not set`);
  return value;
}

/** Cashfree may retry a delivery later, but not with a stale signature. */
const WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Verifies `x-webhook-signature`: base64(HMAC-SHA256(timestamp + rawBody))
 * keyed with the PG secret. Written here instead of using the SDK's
 * `PGVerifyWebhookSignature`, which compares with `===` and has no replay
 * window.
 */
export function verifyCashfreeSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  now = Date.now(),
): boolean {
  if (!signature || !timestamp || !/^\d{10,13}$/.test(timestamp)) return false;

  // Cashfree sends milliseconds; accept seconds too rather than guess wrong.
  const raw = Number(timestamp);
  const sentAt = timestamp.length <= 10 ? raw * 1000 : raw;
  if (Math.abs(now - sentAt) > WEBHOOK_MAX_AGE_MS) return false;

  const secret =
    process.env.CASHFREE_WEBHOOK_SECRET?.trim() ||
    requireEnv("CASHFREE_CLIENT_SECRET");
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest();

  const received = Buffer.from(signature, "base64");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
