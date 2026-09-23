import { randomBytes } from "node:crypto";
import type { BillingSubscription } from "@generated/prisma/client";
import type {
  AuthorizationDetails,
  PlanEntity,
  SubscriptionEntity,
  SubscriptionPaymentEntity,
} from "cashfree-pg";
import { prisma } from "~/db/prisma";
import { type Billing, chargeFor, type Plan, type PlanId } from "~/lib/plans";
import { CashfreeError, cfCall } from ".";

/*
 * Plan state changes in exactly one place: `syncSubscription`, from state
 * fetched from Cashfree's API. Webhooks and the return page only trigger it,
 * so a forged or replayed webhook body can never grant a plan.
 */

/** Our own statuses, alongside Cashfree's subscription_status values. */
export const ABANDONED = "ABANDONED";
export const MISMATCH = "MISMATCH";

/**
 * Statuses after which Cashfree will never charge the mandate again. Anything
 * else, including a status we don't recognise, is treated as live, so the
 * business can't open a second mandate next to one that may still charge.
 */
const TERMINAL_STATUSES = new Set([
  "CANCELLED",
  "CUSTOMER_CANCELLED",
  "EXPIRED",
  "COMPLETED",
  "LINK_EXPIRED",
  "CARD_EXPIRED",
  "FAILED",
  ABANDONED,
  MISMATCH,
]);

export function isLiveStatus(status: string): boolean {
  return !TERMINAL_STATUSES.has(status);
}

/** Still waiting for the customer to finish checkout. */
export const PENDING_STATUSES = new Set(["INITIALIZED", "INITIALISED"]);

/** Checkout links expire before we give up on them (see `abandonIfStale`). */
const CHECKOUT_SESSION_MS = 20 * 60 * 1000;
const ABANDON_AFTER_MS = 30 * 60 * 1000;

/**
 * Versioned so a price change creates a new Cashfree plan instead of
 * silently changing what existing mandates are charged.
 */
export function cashfreePlanId(planId: PlanId, billing: Billing): string {
  return `flonion_${planId}_${billing}_v1`;
}

export function addPeriod(from: Date, billing: Billing): Date {
  const d = new Date(from);
  if (billing === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const ensuredPlans = new Map<string, Promise<void>>();

/**
 * Creates the Cashfree plan on first use. `plan_max_amount` equals the
 * recurring amount, so the mandate can never be charged more than the price.
 */
export function ensureCashfreePlan(
  plan: Plan,
  billing: Billing,
): Promise<void> {
  const cfPlanId = cashfreePlanId(plan.id, billing);
  const existing = ensuredPlans.get(cfPlanId);
  if (existing) return existing;

  const charge = chargeFor(plan, billing);
  if (!charge) return Promise.reject(new Error("Plan has no online price"));

  // A plan id is immutable once created; a different amount or period means
  // the price changed without bumping the `_v1` suffix. Refuse rather than
  // sell at a price the page doesn't show.
  const verify = (found: PlanEntity) => {
    if (
      !sameAmount(found.plan_recurring_amount, charge.total) ||
      !sameAmount(found.plan_max_amount, charge.total) ||
      found.plan_type !== "PERIODIC"
    ) {
      throw new Error(
        `[payments] Cashfree plan ${cfPlanId} doesn't match the price list`,
      );
    }
  };
  const fetchPlan = () =>
    cfCall<PlanEntity>("fetch plan", (cf) => cf.SubsFetchPlan(cfPlanId));

  const run = (async () => {
    try {
      verify(await fetchPlan());
      return;
    } catch (err) {
      // Only "not there" (a 4xx) moves on to creating it.
      const status = err instanceof CashfreeError ? err.status : undefined;
      if (!status || status < 400 || status >= 500) throw err;
    }

    try {
      await cfCall("create plan", (cf) =>
        cf.SubsCreatePlan({
          plan_id: cfPlanId,
          plan_name: `Flonion ${plan.name} (${billing})`,
          plan_type: "PERIODIC",
          plan_currency: "INR",
          plan_recurring_amount: charge.total,
          plan_max_amount: charge.total,
          plan_interval_type: billing === "yearly" ? "YEAR" : "MONTH",
          plan_intervals: 1,
          plan_note: "Includes 18% GST",
        }),
      );
    } catch {
      // Another server instance may have created it first.
      verify(await fetchPlan());
    }
  })();

  ensuredPlans.set(cfPlanId, run);
  run.catch(() => ensuredPlans.delete(cfPlanId));
  return run;
}

export function newSubscriptionId(): string {
  return `flo_${randomBytes(16).toString("hex")}`;
}

/**
 * Creates the mandate on Cashfree for a row already inserted as INITIALIZED.
 * The first period is collected as the authorisation amount (not refunded),
 * and Cashfree's first automatic charge is one period later.
 */
export async function createCashfreeSubscription(input: {
  sub: BillingSubscription;
  plan: Plan;
  customer: { name: string; email: string; phone: string };
}): Promise<string> {
  const { sub, plan, customer } = input;
  const billing = sub.billing as Billing;
  const amount = Number(sub.amount);
  const now = new Date();

  // From env, never from the request's Host header.
  const origin = (
    process.env.BETTER_AUTH_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const created = await cfCall<SubscriptionEntity>(
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
          subscription_first_charge_time: addPeriod(now, billing).toISOString(),
          subscription_tags: {
            business_id: sub.businessId,
            plan: `${plan.id}_${billing}`,
          },
        },
        undefined,
        sub.subscriptionId,
      ),
  );

  if (!created.subscription_session_id) {
    throw new Error("[payments] Cashfree returned no subscription session");
  }

  await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { cfSubscriptionId: created.cf_subscription_id ?? null },
  });

  return created.subscription_session_id;
}

function toDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function sameAmount(a: number | undefined, b: number): boolean {
  return typeof a === "number" && Math.abs(a - b) < 0.005;
}

type PaidPeriod = {
  cfPaymentId: string;
  paymentType: "AUTH" | "CHARGE";
  paidAt: Date;
};

/**
 * Re-reads the subscription and its payments from Cashfree and applies them.
 * Safe to call any number of times, concurrently included: each payment is
 * recorded once (unique `cfPaymentId`) and only that insert extends the
 * paid period.
 */
export async function syncSubscription(
  sub: BillingSubscription,
): Promise<BillingSubscription> {
  const cf = await cfCall<SubscriptionEntity>("fetch subscription", (c) =>
    c.SubsFetchSubscription(sub.subscriptionId),
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
    await cfCall("cancel mismatched subscription", (c) =>
      c.SubsManageSubscription(sub.subscriptionId, {
        subscription_id: sub.subscriptionId,
        action: "CANCEL",
      }),
    ).catch(() => {});
    return prisma.billingSubscription.update({
      where: { id: sub.id },
      data: { status: MISMATCH, liveBusinessId: null },
    });
  }

  // One authorisation per subscription, so its ledger key is deterministic.
  // Both sources below can report it; the unique key counts it once.
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
    const payments = await cfCall<SubscriptionPaymentEntity[]>(
      "fetch subscription payments",
      (c) => c.SubsFetchSubscriptionPayments(sub.subscriptionId),
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

  // A row only becomes live when it's created. One we already retired (say,
  // abandoned, then authorised from an old tab) is never revived, since that
  // would collide with the business's newer live mandate. Its payments still
  // count below, but a person has to look at the duplicate mandate.
  const live = isLiveStatus(status) && sub.liveBusinessId !== null;
  if (isLiveStatus(status) && sub.liveBusinessId === null) {
    console.error("[payments] retired subscription is live on Cashfree", {
      subscriptionId: sub.subscriptionId,
      status,
    });
  }

  return prisma.$transaction(async (tx) => {
    // Serialises every sync for this business, so two payments processed at
    // once can't both extend from the same old expiry.
    const [locked] = await tx.$queryRaw<{ planExpiresAt: Date | null }[]>`
      SELECT "planExpiresAt" FROM "business" WHERE "id" = ${sub.businessId} FOR UPDATE`;
    let expiresAt = locked?.planExpiresAt ?? null;
    let extended = false;

    for (const period of periods) {
      const start = new Date(
        Math.max(expiresAt?.getTime() ?? 0, period.paidAt.getTime()),
      );
      const end = addPeriod(start, sub.billing as Billing);
      const { count } = await tx.billingPayment.createMany({
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
      });
      if (count === 1) {
        expiresAt = end;
        extended = true;
      }
    }

    if (extended) {
      await tx.business.update({
        where: { id: sub.businessId },
        data: { plan: sub.planId, planExpiresAt: expiresAt },
      });
    }

    return tx.billingSubscription.update({
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
    });
  });
}

/**
 * A checkout that was never finished would otherwise block the business from
 * subscribing again. Its session expired after 20 minutes; after 30 we
 * re-check it and, if it still isn't authorised, retire it.
 */
export async function abandonIfStale(
  sub: BillingSubscription,
): Promise<BillingSubscription> {
  if (!PENDING_STATUSES.has(sub.status)) return sub;
  if (Date.now() - sub.createdAt.getTime() < ABANDON_AFTER_MS) return sub;

  const synced = await syncSubscription(sub);
  if (!PENDING_STATUSES.has(synced.status)) return synced;

  await cfCall("cancel abandoned subscription", (c) =>
    c.SubsManageSubscription(sub.subscriptionId, {
      subscription_id: sub.subscriptionId,
      action: "CANCEL",
    }),
  ).catch(() => {
    // Cashfree may refuse to cancel a mandate that was never authorised; the
    // expired session means it can't be authorised now either.
  });

  return prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { status: ABANDONED, liveBusinessId: null },
  });
}

export async function cancelCashfreeSubscription(
  sub: BillingSubscription,
): Promise<BillingSubscription> {
  await cfCall("cancel subscription", (c) =>
    c.SubsManageSubscription(sub.subscriptionId, {
      subscription_id: sub.subscriptionId,
      action: "CANCEL",
    }),
  );
  return syncSubscription(sub);
}
