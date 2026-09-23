import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import { cancelCashfreeSubscription } from "~/lib/payments/subscriptions";
import { checkRateLimit } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";

const CANCEL_RATE_LIMIT = 5;
const CANCEL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Stops auto-renewal. The plan stays until the end of the period already
 * paid for (`Business.planExpiresAt`), so nothing is taken away early.
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
    `billing-cancel:${ctx.businessId}`,
    CANCEL_RATE_LIMIT,
    CANCEL_WINDOW_MS,
  );
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  const sub = await prisma.billingSubscription.findUnique({
    where: { liveBusinessId: ctx.businessId },
  });
  if (!sub) {
    return Response.json(
      { error: "There's no active subscription to cancel" },
      { status: 404 },
    );
  }

  try {
    const cancelled = await cancelCashfreeSubscription(sub);
    return Response.json({ status: cancelled.status });
  } catch {
    return Response.json(
      { error: "Couldn't cancel right now. Please try again." },
      { status: 502 },
    );
  }
}
