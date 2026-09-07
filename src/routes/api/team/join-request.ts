import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { inspectOwnedBusiness } from "~/lib/empty-business";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { sendEmail } from "~/services/email";
import { renderJoinRequestReceivedEmail } from "~/services/email-templates";

const REQUEST_RATE_LIMIT = 5;
const REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

const IP_RATE_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

/** How long a rejected applicant has to wait before asking the same team again. */
const REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const MAX_MESSAGE_LENGTH = 300;

/** Owner plus a handful of admins. Capped so one request can't fan out widely. */
const MAX_NOTIFIED_ADMINS = 5;

const APP_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

/** Asks to join an existing business. */
export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Two keys: a per-user cap alone is defeated by making fresh accounts, and an
  // IP cap alone punishes shared networks.
  const userLimit = checkRateLimit(
    `join-request:${session.user.id}`,
    REQUEST_RATE_LIMIT,
    REQUEST_WINDOW_MS,
  );

  if (!userLimit.allowed) {
    return Response.json(
      { error: "Too many join requests. Please try again tomorrow." },
      { status: 429 },
    );
  }

  const ipLimit = checkRateLimit(
    `join-request-ip:${getClientIp(event.request)}`,
    IP_RATE_LIMIT,
    IP_WINDOW_MS,
  );

  if (!ipLimit.allowed) {
    return Response.json(
      { error: "Too many join requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body = await event.request.json();
    const { businessId, message, confirmDeleteOwnedBusiness } = body;

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        businessId: true,
        business: { select: { id: true } },
      },
    });

    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (
      currentUser.businessId &&
      currentUser.businessId !== currentUser.business?.id
    ) {
      return Response.json(
        { error: "You are already part of a team" },
        { status: 409 },
      );
    }

    // Consent for the escape hatch is captured here, from the person whose
    // business it is. The admin who eventually approves has no visibility into
    // it and cannot meaningfully authorise its deletion, so the answer is
    // persisted on the row and re-verified at approval time.
    if (currentUser.business) {
      const owned = await inspectOwnedBusiness(
        prisma,
        currentUser.business.id,
        session.user.id,
      );

      if (owned && !owned.empty) {
        return Response.json(
          {
            error:
              "You own a business that still has data in it. Delete or hand it over before joining another team.",
            blockers: owned.blockers,
          },
          { status: 409 },
        );
      }

      if (owned && confirmDeleteOwnedBusiness !== true) {
        return Response.json(
          {
            requiresConfirmation: true,
            ownedBusiness: { id: owned.id, name: owned.name },
            error: `Joining a team will permanently delete "${owned.name}", the empty business you own.`,
          },
          { status: 409 },
        );
      }
    }

    if (typeof businessId !== "string" || !businessId.trim()) {
      return Response.json({ error: "Business is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, userId: true },
    });

    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.userId === session.user.id) {
      return Response.json(
        { error: "You can't request to join your own business" },
        { status: 400 },
      );
    }

    let normalizedMessage: string | null = null;
    if (message !== undefined && message !== null) {
      if (typeof message !== "string") {
        return Response.json({ error: "Invalid message" }, { status: 400 });
      }
      const trimmed = message.trim();
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return Response.json(
          { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
          { status: 400 },
        );
      }
      normalizedMessage = trimmed || null;
    }

    // A rejection should not be re-askable immediately, or "reject" becomes a
    // button an admin has to keep pressing.
    const recentRejection = await prisma.joinRequest.findFirst({
      where: {
        userId: session.user.id,
        businessId: business.id,
        status: "rejected",
        reviewedAt: { gt: new Date(Date.now() - REJECTION_COOLDOWN_MS) },
      },
      select: { id: true },
    });

    if (recentRejection) {
      return Response.json(
        {
          error:
            "That team declined a recent request. You can ask again in 24 hours.",
        },
        { status: 429 },
      );
    }

    const existing = await prisma.joinRequest.findFirst({
      where: { userId: session.user.id, status: "pending" },
      select: { id: true, businessId: true },
    });

    if (existing) {
      return Response.json(
        {
          error:
            existing.businessId === business.id
              ? "You already have a pending request to join this team"
              : "You already have a pending request to join another team",
        },
        { status: 409 },
      );
    }

    let joinRequest: { id: string; createdAt: Date };
    try {
      joinRequest = await prisma.joinRequest.create({
        data: {
          businessId: business.id,
          userId: session.user.id,
          // Mirrors `userId` while pending. The unique index on it is what makes
          // a concurrent double-submit a P2002 rather than two live rows.
          pendingUserId: session.user.id,
          message: normalizedMessage,
          consentDeleteOwnedBusiness: confirmDeleteOwnedBusiness === true,
        },
        select: { id: true, createdAt: true },
      });
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        return Response.json(
          { error: "You already have a pending request" },
          { status: 409 },
        );
      }
      throw err;
    }

    // Best effort, and deliberately not rolled back on failure -- unlike
    // /api/team/invite, where the email carries the only copy of the token and a
    // row whose mail never sent is a dead link. Here the row *is* the
    // deliverable: it shows up in the team's queue and on the requester's
    // waiting screen whether or not the provider was up.
    // The owner is fetched by id rather than by `businessId`: that column is
    // NULL for anyone who onboarded before it existed (see business-context.ts),
    // so a single membership-scoped query would silently skip them -- the one
    // person who most needs this email.
    const [owner, admins] = await Promise.all([
      prisma.user.findUnique({
        where: { id: business.userId },
        select: { id: true, email: true, name: true },
      }),
      prisma.user.findMany({
        where: { businessId: business.id, role: "admin" },
        select: { id: true, email: true, name: true },
        take: MAX_NOTIFIED_ADMINS,
      }),
    ]);

    const recipients = [...(owner ? [owner] : []), ...admins].filter(
      (person, index, all) =>
        all.findIndex((other) => other.id === person.id) === index,
    );

    const { html, text } = renderJoinRequestReceivedEmail({
      requesterName: currentUser.name || currentUser.email,
      requesterEmail: currentUser.email,
      businessName: business.name,
      message: normalizedMessage,
      reviewUrl: `${APP_URL}/settings/team`,
    });

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        sendEmail({
          to: recipient.email,
          toName: recipient.name ?? undefined,
          subject: `${currentUser.name || currentUser.email} wants to join ${business.name}`,
          text,
          html,
        }),
      ),
    );

    const notified = results.filter((r) => r.status === "fulfilled").length;
    if (notified < results.length) {
      console.error(
        `[team/join-request] ${results.length - notified} notification(s) failed for business ${business.id}`,
      );
    }

    return Response.json(
      {
        id: joinRequest.id,
        status: "pending",
        businessId: business.id,
        businessName: business.name,
        createdAt: joinRequest.createdAt,
        notified,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[team/join-request] failed:", err);
    return Response.json(
      { error: "Couldn't send your request. Please try again." },
      { status: 500 },
    );
  }
}

/** The caller's own most recent request, whatever its state. */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.joinRequest.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      reviewedAt: true,
      grantedRole: true,
      business: {
        select: { id: true, name: true, username: true, logo: true },
      },
    },
  });

  if (!request) {
    return Response.json({ request: null, joined: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  // The waiting screen polls for exactly this: membership landed, so the
  // approval went through and the client can move on to the dashboard.
  const joined = user?.businessId === request.business.id;

  return Response.json({ request, joined });
}

/** Withdraws the caller's own pending request. */
export async function DELETE(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `reviewedById` stays NULL, which is what distinguishes a withdrawal from an
  // approval-time cancellation.
  const cancelled = await prisma.joinRequest.updateMany({
    where: { userId: session.user.id, status: "pending" },
    data: { status: "cancelled", pendingUserId: null },
  });

  if (cancelled.count === 0) {
    return Response.json({ error: "No pending request" }, { status: 404 });
  }

  return Response.json({ success: true });
}
