import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getBusinessContext } from "~/lib/business-context";
import { syncSubscription } from "~/lib/payments/subscriptions";
import { effectivePlan } from "~/lib/plans";
import { checkRateLimit } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";

const STATUS_RATE_LIMIT = 30;
const STATUS_WINDOW_MS = 60 * 1000;

/**
 * Called by `/upgrade` when Cashfree sends the customer back, so the page
 * doesn't have to wait for the webhook. It goes through the same
 * `syncSubscription` as the webhook and trusts nothing in the URL beyond
 * which subscription to look at.
 */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);
  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  // Each call costs a Cashfree API request.
  const limit = checkRateLimit(
    `billing-status:${ctx.businessId}`,
    STATUS_RATE_LIMIT,
    STATUS_WINDOW_MS,
  );
  if (!limit.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const subscriptionId = new URL(event.request.url).searchParams.get(
    "subscription_id",
  );
  if (!subscriptionId || !/^flo_[a-f0-9]{32}$/.test(subscriptionId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Scoped to the caller's business: another business's id is a 404.
  const sub = await prisma.billingSubscription.findFirst({
    where: { subscriptionId, businessId: ctx.businessId },
  });
  if (!sub) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let synced = sub;
  try {
    synced = await syncSubscription(sub);
  } catch {
    // Report what we last knew; the webhook will catch up.
  }

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { plan: true, planExpiresAt: true },
  });

  return Response.json({
    status: synced.status,
    plan: business ? effectivePlan(business) : "starter",
    planExpiresAt: business?.planExpiresAt ?? null,
  });
}
