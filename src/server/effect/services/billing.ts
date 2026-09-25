import type { BillingSubscription } from "@generated/prisma/client";
import type {
  AuthorizationDetails,
  PlanEntity,
  SubscriptionEntity,
  SubscriptionPaymentEntity,
} from "cashfree-pg";
import {
  Cache,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from "effect";
import {
  ABANDON_AFTER_MS,
  ABANDONED,
  addPeriod,
  CHECKOUT_SESSION_MS,
  cashfreePlanId,
  isLiveStatus,
  MISMATCH,
  PENDING_STATUSES,
  sameAmount,
  toDate,
} from "~/lib/payments/subscriptions";
import {
  type Billing as BillingPeriod,
  chargeFor,
  PLANS,
  type Plan,
  type PlanId,
} from "~/lib/plans";
import { appOrigin } from "../config";
import type { DbError } from "../errors";
import { Cashfree, type CashfreeFailure } from "./cashfree";
import { Db } from "./db";

/*
 * Plan state changes in exactly one place: `sync`, from state fetched from
 * Cashfree's API. Webhooks and the return page only trigger it, so a forged
 * or replayed webhook body can never grant a plan.
 */

/** Our side refused: no online price, or Cashfree's plan disagrees with ours. */
export class BillingError extends Schema.TaggedError<BillingError>()(
  "BillingError",
  { message: Schema.String },
) {}

type SyncError = CashfreeFailure | DbError;

export class Billing extends Context.Service<
  Billing,
  {
    /**
     * Creates the Cashfree plan on first use. Concurrent callers share one
     * attempt; a failure is not remembered, so the next call tries again.
     */
    readonly ensurePlan: (
      plan: Plan,
      billing: BillingPeriod,
    ) => Effect.Effect<void, CashfreeFailure | BillingError>;
    /**
     * Creates the mandate on Cashfree for a row already inserted as
     * INITIALIZED and returns the checkout session id. Never retried.
     */
    readonly createSubscription: (input: {
      sub: BillingSubscription;
      plan: Plan;
      customer: { name: string; email: string; phone: string };
    }) => Effect.Effect<string, CashfreeFailure | BillingError | DbError>;
    /**
     * Re-reads the subscription and its payments from Cashfree and applies
     * them. Idempotent, concurrent calls included.
     */
    readonly sync: (
      sub: BillingSubscription,
    ) => Effect.Effect<BillingSubscription, SyncError>;
    /** Retires a checkout left unfinished for 30 minutes. */
    readonly abandonIfStale: (
      sub: BillingSubscription,
    ) => Effect.Effect<BillingSubscription, SyncError>;
    /** Stops auto-renewal, then re-syncs. The cancel is never retried. */
    readonly cancel: (
      sub: BillingSubscription,
    ) => Effect.Effect<BillingSubscription, SyncError>;
  }
>()("revme/Billing") {
  /** Needs `Cashfree` and `Db`; tests provide fakes. */
  static readonly layerWithoutDependencies = Layer.effect(
    Billing,
    makeBilling(),
  );
  static readonly layer = Billing.layerWithoutDependencies.pipe(
    Layer.provide(Layer.mergeAll(Cashfree.layer, Db.layer)),
  );
}

type PlanKey = `${PlanId}:${BillingPeriod}`;

type PaidPeriod = {
  cfPaymentId: string;
  paymentType: "AUTH" | "CHARGE";
  paidAt: Date;
};

const cancelAction = (subscriptionId: string) => ({
  subscription_id: subscriptionId,
  action: "CANCEL",
});

function makeBilling() {
  return Effect.gen(function* () {
    const cashfree = yield* Cashfree;
    const db = yield* Db;

    const ensureOnePlan = Effect.fn("Billing.ensureOnePlan")(function* (
      plan: Plan,
      billing: BillingPeriod,
    ) {
      const cfPlanId = cashfreePlanId(plan.id, billing);
      const charge = chargeFor(plan, billing);
      if (!charge) {
        return yield* new BillingError({ message: "Plan has no online price" });
      }

      // A plan id is immutable once created; a different amount or period
      // means the price changed without bumping the `_v1` suffix. Refuse
      // rather than sell at a price the page doesn't show.
      const verify = (found: PlanEntity) =>
        sameAmount(found.plan_recurring_amount, charge.total) &&
        sameAmount(found.plan_max_amount, charge.total) &&
        found.plan_type === "PERIODIC"
          ? Effect.void
          : Effect.fail(
              new BillingError({
                message: `[payments] Cashfree plan ${cfPlanId} doesn't match the price list`,
              }),
            );
      const fetchPlan = cashfree.call<PlanEntity>(
        "fetch plan",
        (cf) => cf.SubsFetchPlan(cfPlanId),
        { retry: true },
      );

      // Only "not there" (a 4xx) moves on to creating it.
      const existing = yield* fetchPlan.pipe(
        Effect.map(Option.some),
        Effect.catchIf(
          (e) => e.status !== undefined && e.status >= 400 && e.status < 500,
          () => Effect.succeedNone,
        ),
      );
      if (Option.isSome(existing)) return yield* verify(existing.value);

      yield* cashfree
        .call("create plan", (cf) =>
          cf.SubsCreatePlan({
            plan_id: cfPlanId,
            // Cashfree allows only alphanumerics and a few special
            // characters here; parentheses get a 400.
            plan_name: `Flonion ${plan.name} ${billing === "yearly" ? "Yearly" : "Monthly"}`,
            plan_type: "PERIODIC",
            plan_currency: "INR",
            plan_recurring_amount: charge.total,
            plan_max_amount: charge.total,
            plan_interval_type: billing === "yearly" ? "YEAR" : "MONTH",
            plan_intervals: 1,
            plan_note: "Includes 18 percent GST",
          }),
        )
        .pipe(
          // Another server instance may have created it first.
          Effect.catch(() => Effect.flatMap(fetchPlan, verify)),
        );
    });

    const plans = yield* Cache.makeWith(
      (key: PlanKey) => {
        const [planId, billing] = key.split(":") as [PlanId, BillingPeriod];
        const plan = PLANS.find((p) => p.id === planId);
        return plan
          ? ensureOnePlan(plan, billing)
          : Effect.fail(new BillingError({ message: "Unknown plan" }));
      },
      {
        capacity: 16,
        timeToLive: (exit) =>
          Exit.isSuccess(exit) ? Duration.infinity : Duration.zero,
      },
    );

    const sync = Effect.fn("Billing.sync")(function* (
      sub: BillingSubscription,
    ) {
      const cf = yield* cashfree.call<SubscriptionEntity>(
        "fetch subscription",
        (c) => c.SubsFetchSubscription(sub.subscriptionId),
        { retry: true },
      );
      const cfStatus = cf.subscription_status ?? sub.status;
      // A retired row whose checkout Cashfree still calls pending stays retired.
      const status =
        sub.liveBusinessId === null && PENDING_STATUSES.has(cfStatus)
          ? sub.status
          : cfStatus;
      const expected = Number(sub.amount);

      // Integrity: the mandate must be for the plan and price we created.
      const planOk =
        cf.plan_details?.plan_id === sub.cfPlanId &&
        (cf.plan_details?.plan_recurring_amount === undefined ||
          sameAmount(cf.plan_details.plan_recurring_amount, expected));
      if (!planOk) {
        console.error("[payments] subscription does not match its plan", {
          subscriptionId: sub.subscriptionId,
          cfPlanId: cf.plan_details?.plan_id,
        });
        yield* cashfree
          .call("cancel mismatched subscription", (c) =>
            c.SubsManageSubscription(
              sub.subscriptionId,
              cancelAction(sub.subscriptionId),
            ),
          )
          .pipe(Effect.ignore);
        return yield* db.use((p) =>
          p.billingSubscription.update({
            where: { id: sub.id },
            data: { status: MISMATCH, liveBusinessId: null },
          }),
        );
      }

      // One authorisation per subscription, so its ledger key is
      // deterministic. Both sources below can report it; the unique key
      // counts it once.
      const authKey = `auth:${sub.subscriptionId}`;
      const periods: PaidPeriod[] = [];
      // Cashfree's docs spell this both ways across versions; read either.
      const auth =
        cf.authorisation_details ??
        (cf as { authorization_details?: AuthorizationDetails })
          .authorization_details;
      if (
        auth?.authorization_status === "ACTIVE" &&
        auth.authorization_amount_refund === false &&
        sameAmount(auth.authorization_amount, expected)
      ) {
        periods.push({
          cfPaymentId: authKey,
          paymentType: "AUTH",
          paidAt: toDate(auth.authorization_time, new Date()),
        });
      }

      if (!PENDING_STATUSES.has(status)) {
        const payments = yield* cashfree.call<SubscriptionPaymentEntity[]>(
          "fetch subscription payments",
          (c) => c.SubsFetchSubscriptionPayments(sub.subscriptionId),
          { retry: true },
        );
        for (const p of payments ?? []) {
          if (p.payment_status !== "SUCCESS") continue;
          if (p.payment_type === "AUTH") {
            if (sameAmount(p.payment_amount, expected)) {
              periods.push({
                cfPaymentId: authKey,
                paymentType: "AUTH",
                paidAt: toDate(p.payment_initiated_date, new Date()),
              });
            }
            continue;
          }
          if (!p.cf_payment_id) continue;
          if (!sameAmount(p.payment_amount, expected)) {
            console.error("[payments] charge amount mismatch", {
              subscriptionId: sub.subscriptionId,
              cfPaymentId: p.cf_payment_id,
            });
            continue;
          }
          periods.push({
            cfPaymentId: String(p.cf_payment_id),
            paymentType: "CHARGE",
            paidAt: toDate(
              p.payment_initiated_date ?? p.payment_schedule_date,
              new Date(),
            ),
          });
        }
      }
      periods.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

      // A row only becomes live when it's created. One we already retired
      // (say, abandoned, then authorised from an old tab) is never revived,
      // since that would collide with the business's newer live mandate. Its
      // payments still count below, but a person has to look at the
      // duplicate mandate.
      const live = isLiveStatus(status) && sub.liveBusinessId !== null;
      if (isLiveStatus(status) && sub.liveBusinessId === null) {
        console.error("[payments] retired subscription is live on Cashfree", {
          subscriptionId: sub.subscriptionId,
          status,
        });
      }

      return yield* db.transaction(
        Effect.gen(function* () {
          const tx = yield* Db;
          // Serialises every sync for this business, so two payments
          // processed at once can't both extend from the same old expiry.
          const [locked] = yield* tx.use(
            (p) => p.$queryRaw<{ planExpiresAt: Date | null }[]>`
              SELECT "planExpiresAt" FROM "business" WHERE "id" = ${sub.businessId} FOR UPDATE`,
          );
          let expiresAt = locked?.planExpiresAt ?? null;
          let extended = false;

          for (const period of periods) {
            const start = new Date(
              Math.max(expiresAt?.getTime() ?? 0, period.paidAt.getTime()),
            );
            const end = addPeriod(start, sub.billing as BillingPeriod);
            const { count } = yield* tx.use((p) =>
              p.billingPayment.createMany({
                data: [
                  {
                    cfPaymentId: period.cfPaymentId,
                    subscriptionId: sub.id,
                    amount: sub.amount,
                    paymentType: period.paymentType,
                    periodStart: start,
                    periodEnd: end,
                  },
                ],
                skipDuplicates: true,
              }),
            );
            if (count === 1) {
              expiresAt = end;
              extended = true;
            }
          }

          if (extended) {
            yield* tx.use((p) =>
              p.business.update({
                where: { id: sub.businessId },
                data: { plan: sub.planId, planExpiresAt: expiresAt },
              }),
            );
          }

          return yield* tx.use((p) =>
            p.billingSubscription.update({
              where: { id: sub.id },
              data: {
                status,
                cfSubscriptionId: cf.cf_subscription_id ?? sub.cfSubscriptionId,
                liveBusinessId: live ? sub.businessId : null,
                cancelledAt:
                  !live && !sub.cancelledAt && status.includes("CANCELLED")
                    ? new Date()
                    : sub.cancelledAt,
              },
            }),
          );
        }),
      );
    });

    return Billing.of({
      ensurePlan: (plan, billing) => {
        const key: PlanKey = `${plan.id}:${billing}`;
        return Cache.get(plans, key);
      },

      createSubscription: Effect.fn("Billing.createSubscription")(function* ({
        sub,
        plan,
        customer,
      }) {
        const billing = sub.billing as BillingPeriod;
        const amount = Number(sub.amount);
        const now = new Date();

        // From env, never from the request's Host header.
        const origin = (yield* appOrigin).replace(/\/+$/, "");

        const created = yield* cashfree.call<SubscriptionEntity>(
          "create subscription",
          (cf) =>
            cf.SubsCreateSubscription(
              {
                subscription_id: sub.subscriptionId,
                customer_details: {
                  customer_name: customer.name.slice(0, 100),
                  customer_email: customer.email,
                  customer_phone: customer.phone,
                },
                plan_details: { plan_id: sub.cfPlanId },
                authorization_details: {
                  authorization_amount: amount,
                  authorization_amount_refund: false,
                },
                subscription_meta: {
                  return_url: `${origin}/upgrade?subscription_id=${sub.subscriptionId}`,
                  session_id_expiry: new Date(
                    now.getTime() + CHECKOUT_SESSION_MS,
                  ).toISOString(),
                },
                subscription_first_charge_time: addPeriod(
                  now,
                  billing,
                ).toISOString(),
                subscription_tags: {
                  business_id: sub.businessId,
                  plan: `${plan.id}_${billing}`,
                },
              },
              undefined,
              sub.subscriptionId,
            ),
        );

        const sessionId = created.subscription_session_id;
        if (!sessionId) {
          return yield* new BillingError({
            message: "[payments] Cashfree returned no subscription session",
          });
        }

        yield* db.use((p) =>
          p.billingSubscription.update({
            where: { id: sub.id },
            data: { cfSubscriptionId: created.cf_subscription_id ?? null },
          }),
        );

        return sessionId;
      }),

      sync,

      abandonIfStale: Effect.fn("Billing.abandonIfStale")(function* (sub) {
        if (!PENDING_STATUSES.has(sub.status)) return sub;
        if (Date.now() - sub.createdAt.getTime() < ABANDON_AFTER_MS) return sub;

        const synced = yield* sync(sub);
        if (!PENDING_STATUSES.has(synced.status)) return synced;

        // Cashfree may refuse to cancel a mandate that was never authorised;
        // the expired session means it can't be authorised now either.
        yield* cashfree
          .call("cancel abandoned subscription", (c) =>
            c.SubsManageSubscription(
              sub.subscriptionId,
              cancelAction(sub.subscriptionId),
            ),
          )
          .pipe(Effect.ignore);

        return yield* db.use((p) =>
          p.billingSubscription.update({
            where: { id: sub.id },
            data: { status: ABANDONED, liveBusinessId: null },
          }),
        );
      }),

      cancel: Effect.fn("Billing.cancel")(function* (sub) {
        yield* cashfree.call("cancel subscription", (c) =>
          c.SubsManageSubscription(
            sub.subscriptionId,
            cancelAction(sub.subscriptionId),
          ),
        );
        return yield* sync(sub);
      }),
    });
  });
}
