import { Effect, Predicate } from "effect";
import { verifyCashfreeSignature } from "~/lib/payments";
import { RawResponse } from "~/server/effect/errors";
import { recoverAll } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Billing } from "~/server/effect/services/billing";
import { Db } from "~/server/effect/services/db";

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

/** Cashfree only reads the status; every answer has an empty body. */
const empty = (status: number) =>
  new RawResponse({ response: new Response(null, { status }) });

/**
 * Cashfree subscription webhooks. Public (see `PUBLIC_PREFIXES` in
 * middleware); the HMAC signature is the only authentication.
 *
 * A verified event is only a hint that something changed: the body is never
 * applied. The subscription is looked up in our own table and re-read from
 * Cashfree's API by `Billing.sync`, which is idempotent, so replays and
 * retries are harmless.
 */
export const POST = handler(
  "webhooks.cashfree",
  Effect.gen(function* () {
    const { request } = yield* RequestContext;

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) return yield* empty(413);

    const rawBody = yield* Effect.promise(() => request.text());
    if (rawBody.length > MAX_BODY_BYTES) return yield* empty(413);

    const valid = verifyCashfreeSignature(
      rawBody,
      request.headers.get("x-webhook-signature"),
      request.headers.get("x-webhook-timestamp"),
    );
    if (!valid) return yield* empty(401);

    const payload = yield* Effect.try({
      try: () => JSON.parse(rawBody) as unknown,
      catch: () => empty(400),
    });

    const type =
      Predicate.isObject(payload) && typeof payload.type === "string"
        ? payload.type
        : "";
    if (!type.startsWith("SUBSCRIPTION_")) return yield* empty(200);

    const subscriptionId = subscriptionIdOf(payload);
    const db = yield* Db;
    const sub = subscriptionId
      ? yield* db.use((p) =>
          p.billingSubscription.findUnique({ where: { subscriptionId } }),
        )
      : null;
    // Not one of ours, e.g. created in the Cashfree dashboard.
    if (!sub) return yield* empty(200);

    const billing = yield* Billing;
    // Any failure answers non-2xx, which makes Cashfree retry the delivery.
    yield* billing.sync(sub).pipe(recoverAll(empty(503)));

    return new Response(null, { status: 200 });
  }),
);
