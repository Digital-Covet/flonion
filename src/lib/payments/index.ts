import { createHmac, timingSafeEqual } from "node:crypto";
import { Cashfree, CFEnvironment } from "cashfree-pg";

/*
 * Server-only. Import this from `src/routes/api/**` and never from a
 * component: it reads the Cashfree secret.
 */

/**
 * Pinned rather than left to the SDK default, because the subscription and
 * webhook shapes this code reads are the ones documented for this version.
 * Set the same version on the Cashfree dashboard's webhook.
 */
export const CASHFREE_API_VERSION = "2025-01-01";

let client: Cashfree | undefined;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[payments] ${name} is not set`);
  return value;
}

/**
 * `CASHFREE_ENV` has no default on purpose: production keys must never be
 * sent to the sandbox by omission, or sandbox keys quietly used in production.
 */
export function getCashfree(): Cashfree {
  if (client) return client;

  const env = requireEnv("CASHFREE_ENV");
  if (env !== "sandbox" && env !== "production") {
    throw new Error("[payments] CASHFREE_ENV must be sandbox or production");
  }

  client = new Cashfree(
    env === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    requireEnv("CASHFREE_CLIENT_ID"),
    requireEnv("CASHFREE_CLIENT_SECRET"),
    undefined,
    undefined,
    undefined,
    // Keep false. When true, the SDK runs `Sentry.init` with Cashfree's own
    // DSN and 100% trace sampling inside this process, which ships traces of
    // our unrelated requests to a third party.
    false,
  );
  client.XApiVersion = CASHFREE_API_VERSION;
  return client;
}

export class CashfreeError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(
    message: string,
    status: number | undefined,
    code: string | undefined,
  ) {
    super(message);
    this.name = "CashfreeError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Every SDK call goes through here. A raw AxiosError carries the request
 * config, headers included, so logging it would write `x-client-secret` to
 * the server log. Only Cashfree's status, code and message survive.
 */
export async function cfCall<T>(
  label: string,
  fn: (cf: Cashfree) => Promise<{ data: T }>,
): Promise<T> {
  try {
    const res = await fn(getCashfree());
    return res.data;
  } catch (err) {
    const response = (
      err as {
        response?: {
          status?: number;
          data?: { code?: string; message?: string };
        };
      }
    )?.response;
    const status = response?.status;
    const code = response?.data?.code;
    const message =
      response?.data?.message ??
      (err instanceof Error && !response
        ? err.message
        : "Cashfree request failed");
    console.error(`[payments] ${label} failed`, { status, code, message });
    throw new CashfreeError(message, status, code);
  }
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
