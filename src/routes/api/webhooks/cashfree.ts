import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { verifyCashfreeSignature } from "~/lib/payments";
import { syncSubscription } from "~/lib/payments/subscriptions";

/** Cashfree's subscription events are a few KB; anything larger is not one. */
const MAX_BODY_BYTES = 64 * 1024;

/** Finds the subscription id wherever this event type keeps it. */
function subscriptionIdOf(payload: unknown): string | null {
  const data = (payload as { data?: Record<string, unknown> })?.data;
  if (!data || typeof data !== "object") return null;

  const candidates = [
    data.subscription_id,
    (data.subscription_details as { subscription_id?: unknown } | undefined)
      ?.subscription_id,
    (
      data.subscription_status_webhook as
        | { subscription_details?: { subscription_id?: unknown } }
        | undefined
    )?.subscription_details?.subscription_id,
  ];
  const id = candidates.find((c) => typeof c === "string");
  return typeof id === "string" ? id : null;
}

/**
 * Cashfree subscription webhooks. Public (see `PUBLIC_PREFIXES` in
 * middleware); the HMAC signature is the only authentication.
 *
 * A verified event is only a hint that something changed: the body is never
 * applied. The subscription is looked up in our own table and re-read from
 * Cashfree's API by `syncSubscription`, which is idempotent, so replays and
 * retries are harmless.
 */
export async function POST(event: APIEvent) {
  const length = Number(event.request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const rawBody = await event.request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const valid = verifyCashfreeSignature(
    rawBody,
    event.request.headers.get("x-webhook-signature"),
    event.request.headers.get("x-webhook-timestamp"),
  );
  if (!valid) {
    return new Response(null, { status: 401 });
  }

  let payload: { type?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 400 });
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  if (!type.startsWith("SUBSCRIPTION_")) {
    return new Response(null, { status: 200 });
  }

  const subscriptionId = subscriptionIdOf(payload);
  const sub = subscriptionId
    ? await prisma.billingSubscription.findUnique({
        where: { subscriptionId },
      })
    : null;
  if (!sub) {
    // Not one of ours, e.g. created in the Cashfree dashboard.
    return new Response(null, { status: 200 });
  }

  try {
    await syncSubscription(sub);
  } catch {
    // Non-2xx makes Cashfree retry the delivery later.
    return new Response(null, { status: 503 });
  }

  return new Response(null, { status: 200 });
}
