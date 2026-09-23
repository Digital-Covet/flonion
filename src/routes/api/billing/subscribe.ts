import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import {
  abandonIfStale,
  cashfreePlanId,
  createCashfreeSubscription,
  ensureCashfreePlan,
  newSubscriptionId,
} from "~/lib/payments/subscriptions";
import {
  chargeFor,
  effectivePlan,
  isBilling,
  isPlanId,
  isUpgrade,
  PLANS,
} from "~/lib/plans";
import { checkRateLimit } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";

const SUBSCRIBE_RATE_LIMIT = 5;
const SUBSCRIBE_WINDOW_MS = 60 * 60 * 1000;

/** Indian mobile number, as Cashfree's mandate flows require. */
const PHONE_RE = /^[6-9]\d{9}$/;

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s()-]/g, "").replace(/^(\+91|0091|0)/, "");
  return PHONE_RE.test(digits) ? digits : null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Starts a Cashfree subscription for a paid plan and returns the session the
 * browser opens checkout with. The amount comes from `chargeFor`, never from
 * the request. Nothing is granted here: the plan changes only once
 * `syncSubscription` sees the authorised mandate.
 */
export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);
  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }
  if (!canManageTeam(ctx)) {
    return Response.json(
      { error: "Only the business owner or an admin can change the plan" },
      { status: 403 },
    );
  }

  const limit = checkRateLimit(
    `billing-subscribe:${ctx.businessId}`,
    SUBSCRIBE_RATE_LIMIT,
    SUBSCRIBE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  let body: { planId?: unknown; billing?: unknown; phone?: unknown };
  try {
    body = await event.request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { planId, billing } = body;
  if (!isPlanId(planId) || !isBilling(billing)) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }
  const plan = PLANS.find((p) => p.id === planId);
  const charge = plan ? chargeFor(plan, billing) : null;
  if (!plan || !charge) {
    return Response.json(
      { error: "That plan can't be bought online" },
      { status: 400 },
    );
  }

  const [business, user] = await Promise.all([
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { plan: true, planExpiresAt: true, phone: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
  ]);
  if (!business || !user) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  if (!isUpgrade(effectivePlan(business), plan.id)) {
    return Response.json(
      { error: "Your business is already on this plan or higher" },
      { status: 409 },
    );
  }

  // A business may have one live mandate. An abandoned checkout is retired
  // first so it doesn't block a fresh attempt.
  const existing = await prisma.billingSubscription.findUnique({
    where: { liveBusinessId: ctx.businessId },
  });
  if (existing) {
    const current = await abandonIfStale(existing).catch(() => existing);
    if (current.liveBusinessId) {
      return Response.json(
        {
          error:
            current.status === "BANK_APPROVAL_PENDING"
              ? "A mandate is waiting for your bank's approval. Try again once it's resolved."
              : "A subscription is already in progress for this business. Finish or wait for it before starting another.",
        },
        { status: 409 },
      );
    }
  }

  const phone =
    normalizePhone(body.phone) ?? normalizePhone(business.phone ?? "");
  if (!phone) {
    return Response.json(
      { error: "Enter a 10-digit Indian mobile number", field: "phone" },
      { status: 400 },
    );
  }

  try {
    await ensureCashfreePlan(plan, billing);
  } catch {
    return Response.json(
      { error: "Payments are unavailable right now. Please try again later." },
      { status: 502 },
    );
  }

  // Inserted before Cashfree is called: the unique `liveBusinessId` turns a
  // concurrent second request into a P2002 here instead of a second mandate.
  let sub: Awaited<ReturnType<typeof prisma.billingSubscription.create>>;
  try {
    sub = await prisma.billingSubscription.create({
      data: {
        subscriptionId: newSubscriptionId(),
        businessId: ctx.businessId,
        liveBusinessId: ctx.businessId,
        createdById: session.user.id,
        planId: plan.id,
        billing,
        cfPlanId: cashfreePlanId(plan.id, billing),
        amount: charge.total,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return Response.json(
        { error: "A subscription is already in progress for this business." },
        { status: 409 },
      );
    }
    throw err;
  }

  try {
    const subsSessionId = await createCashfreeSubscription({
      sub,
      plan,
      customer: { name: user.name, email: user.email, phone },
    });

    // Saved only once Cashfree accepted it, and never over an existing one.
    if (!business.phone) {
      await prisma.business
        .update({ where: { id: ctx.businessId }, data: { phone } })
        .catch(() => {});
    }

    return Response.json(
      { subsSessionId, subscriptionId: sub.subscriptionId },
      { status: 201 },
    );
  } catch {
    // Nothing was authorised, so free the slot for a retry.
    await prisma.billingSubscription
      .update({
        where: { id: sub.id },
        data: { status: "FAILED", liveBusinessId: null },
      })
      .catch(() => {});
    return Response.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 },
    );
  }
}
