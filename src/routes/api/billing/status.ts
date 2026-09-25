import { Effect, Schema } from "effect";
import { effectivePlan } from "~/lib/plans";
import { NotFound } from "~/server/effect/errors";
import {
  decodeSearchParams,
  orElseAll,
  rateLimit,
  requireBusinessContext,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Billing } from "~/server/effect/services/billing";
import { Db } from "~/server/effect/services/db";

const STATUS_RATE_LIMIT = 30;
const STATUS_WINDOW_MS = 60 * 1000;

const Query = Schema.Struct({
  subscription_id: Schema.optionalKey(
    Schema.String.pipe(Schema.check(Schema.isPattern(/^flo_[a-f0-9]{32}$/))),
  ),
});

/**
 * Called by `/upgrade` when Cashfree sends the customer back, so the page
 * doesn't have to wait for the webhook. It goes through the same `sync` as
 * the webhook and trusts nothing in the URL beyond which subscription to
 * look at.
 *
 * Without `subscription_id` it syncs the business's live subscription. The
 * page calls it that way while a checkout still looks pending, so a mandate
 * authorised without the redirect back (the tab closed, a QR paid on the
 * phone) and without a delivered webhook still switches the plan on.
 */
export const GET = handler(
  "billing.status",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    // Each call costs a Cashfree API request.
    yield* rateLimit(
      `billing-status:${ctx.businessId}`,
      STATUS_RATE_LIMIT,
      STATUS_WINDOW_MS,
      { message: "Too many requests" },
    );

    const notFound = new NotFound({ message: "Not found" });
    const { subscription_id: subscriptionId } = yield* decodeSearchParams(
      Query,
      () => notFound,
    );

    const db = yield* Db;
    // Scoped to the caller's business: another business's id is a 404.
    const sub = yield* db.use((p) =>
      p.billingSubscription.findFirst({
        where: subscriptionId
          ? { subscriptionId, businessId: ctx.businessId }
          : { liveBusinessId: ctx.businessId },
      }),
    );
    if (!sub) return yield* notFound;

    // On failure, report what we last knew; the webhook will catch up.
    const billing = yield* Billing;
    const synced = yield* billing.sync(sub).pipe(orElseAll(() => sub));

    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { id: ctx.businessId },
        select: { plan: true, planExpiresAt: true },
      }),
    );

    return {
      status: synced.status,
      plan: business ? effectivePlan(business) : "starter",
      planExpiresAt: business?.planExpiresAt ?? null,
    };
  }),
);
