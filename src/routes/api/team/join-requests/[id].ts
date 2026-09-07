import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import { ClaimConflictError, inspectOwnedBusiness } from "~/lib/empty-business";
import { checkRateLimit } from "~/lib/rate-limit";
import { isValidRole } from "~/lib/roles";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { sendEmail } from "~/services/email";
import {
  renderJoinRequestApprovedEmail,
  renderJoinRequestRejectedEmail,
} from "~/services/email-templates";

const REVIEW_RATE_LIMIT = 100;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;

const APP_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

export async function PATCH(event: APIEvent) {
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
      { error: "Only admins or the business owner can review join requests" },
      { status: 403 },
    );
  }

  const reviewLimit = checkRateLimit(
    `join-review:${ctx.businessId}`,
    REVIEW_RATE_LIMIT,
    REVIEW_WINDOW_MS,
  );

  if (!reviewLimit.allowed) {
    return Response.json(
      { error: "Too many reviews. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body = await event.request.json();
    const { action, role } = body;

    if (action !== "approve" && action !== "reject") {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const grantedRole =
      typeof role === "string" && isValidRole(role) ? role : "member";

    const requestId = event.params.id;

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        businessId: true,
        userId: true,
        status: true,
        consentDeleteOwnedBusiness: true,
        business: { select: { name: true } },
        user: { select: { email: true, name: true } },
      },
    });

    // One message for "no such row" and "belongs to another business", so ids
    // from other teams can't be probed for existence.
    if (!joinRequest || joinRequest.businessId !== ctx.businessId) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    if (joinRequest.status !== "pending") {
      return Response.json(
        { error: "Request is no longer pending" },
        { status: 409 },
      );
    }

    if (action === "reject") {
      // A single guarded statement, so no transaction is needed.
      const rejected = await prisma.joinRequest.updateMany({
        where: { id: joinRequest.id, status: "pending" },
        data: {
          status: "rejected",
          pendingUserId: null,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      if (rejected.count === 0) {
        return Response.json(
          { error: "Request is no longer pending" },
          { status: 409 },
        );
      }

      const { html, text } = renderJoinRequestRejectedEmail({
        businessName: joinRequest.business.name,
      });

      // Best effort: the decision is already recorded.
      await sendEmail({
        to: joinRequest.user.email,
        toName: joinRequest.user.name ?? undefined,
        subject: `Your request to join ${joinRequest.business.name}`,
        text,
        html,
      }).catch((err) => {
        console.error("[team/join-requests] rejection email failed:", err);
      });

      return Response.json({ success: true, status: "rejected" });
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          const claimed = await tx.joinRequest.updateMany({
            where: { id: joinRequest.id, status: "pending" },
            data: {
              status: "approved",
              grantedRole,
              pendingUserId: null,
              reviewedById: session.user.id,
              reviewedAt: new Date(),
            },
          });

          if (claimed.count === 0) {
            throw new ClaimConflictError("not_pending");
          }

          // Everything below is re-derived from live state rather than from the
          // snapshot taken when the request was made: days can pass, and the
          // requester may have connected a review profile or joined elsewhere
          // in the meantime.
          const joiner = await tx.user.findUnique({
            where: { id: joinRequest.userId },
            select: { businessId: true, business: { select: { id: true } } },
          });

          if (!joiner) {
            throw new ClaimConflictError("user_gone");
          }

          const ownedId = joiner.business?.id ?? null;

          if (joiner.businessId && joiner.businessId !== ownedId) {
            throw new ClaimConflictError("joined_elsewhere");
          }

          if (ownedId) {
            // Consent belongs to the requester, and only they can give it. The
            // reviewer cannot authorise deleting a business they can't see.
            if (!joinRequest.consentDeleteOwnedBusiness) {
              throw new ClaimConflictError("needs_consent");
            }

            const owned = await inspectOwnedBusiness(
              tx,
              ownedId,
              joinRequest.userId,
            );

            if (!owned?.empty) {
              throw new ClaimConflictError(
                "owns_business",
                owned?.blockers ?? [],
              );
            }

            // Guarded by userId so a concurrent ownership change aborts the
            // approval instead of deleting a business that is no longer theirs.
            const removed = await tx.business.deleteMany({
              where: { id: ownedId, userId: joinRequest.userId },
            });

            if (removed.count !== 1) {
              throw new ClaimConflictError("not_pending");
            }
          }

          // LAST write in the transaction, and it must stay last -- see the
          // ordering note in accept-invite.ts. Deleting the owned business fires
          // an onDelete: SetNull trigger over `user.businessId`; setting
          // membership afterwards is what keeps that trigger from clearing the
          // membership we just granted.
          await tx.user.update({
            where: { id: joinRequest.userId },
            data: {
              businessId: ctx.businessId,
              role: grantedRole,
              onboardingCompleted: true,
            },
          });
        },
        { timeout: 15_000 },
      );
    } catch (err) {
      if (err instanceof ClaimConflictError) {
        if (err.code === "joined_elsewhere") {
          // Repaired outside the transaction, which rolled the approval back.
          // The row leaves the queue rather than sitting there un-approvable.
          await prisma.joinRequest.updateMany({
            where: { id: joinRequest.id },
            data: {
              status: "cancelled",
              grantedRole: null,
              pendingUserId: null,
              reviewedById: session.user.id,
              reviewedAt: new Date(),
            },
          });

          return Response.json(
            {
              error: "They have since joined another team",
              resolved: true,
            },
            { status: 409 },
          );
        }

        // The remaining conflicts leave the request pending on purpose: each is
        // fixable by the requester, and the approve button should keep working
        // once it is.
        const conflicts: Record<string, { status: number; error: string }> = {
          not_pending: {
            status: 409,
            error: "Request is no longer pending",
          },
          user_gone: {
            status: 410,
            error: "That account no longer exists",
          },
          needs_consent: {
            status: 409,
            error:
              "They own a business and haven't agreed to have it removed. Ask them to withdraw and send the request again.",
          },
          owns_business: {
            status: 409,
            error: "They own a business that still has data in it.",
          },
        };

        const conflict = conflicts[err.code];
        return Response.json(
          { error: conflict.error, blockers: err.blockers },
          { status: conflict.status },
        );
      }
      throw err;
    }

    const { html, text } = renderJoinRequestApprovedEmail({
      businessName: joinRequest.business.name,
      role: grantedRole,
      dashboardUrl: `${APP_URL}/dashboard`,
    });

    // Best effort, and never rolled back: the membership is already committed,
    // and a failed courtesy email must not un-grant it.
    await sendEmail({
      to: joinRequest.user.email,
      toName: joinRequest.user.name ?? undefined,
      subject: `You've joined ${joinRequest.business.name}`,
      text,
      html,
    }).catch((err) => {
      console.error("[team/join-requests] approval email failed:", err);
    });

    return Response.json({
      success: true,
      status: "approved",
      role: grantedRole,
      userId: joinRequest.userId,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[team/join-requests] failed:", err);
    return Response.json(
      { error: "Couldn't review the request. Please try again." },
      { status: 500 },
    );
  }
}
