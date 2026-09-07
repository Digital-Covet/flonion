import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { ClaimConflictError, inspectOwnedBusiness } from "~/lib/empty-business";
import { getSessionFromHeaders } from "~/lib/server-auth";

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { token, confirmDeleteOwnedBusiness } = body;

    if (typeof token !== "string" || !token) {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        businessId: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      return Response.json({ error: "Invalid invitation" }, { status: 404 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        businessId: true,
        business: { select: { id: true } },
      },
    });

    if (currentUser?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return Response.json(
        { error: "This invitation is for a different email address" },
        { status: 400 },
      );
    }

    // Re-clicking the link after a successful accept should be a no-op, not an
    // error, so the membership check runs before the status check.
    if (currentUser.businessId === invitation.businessId) {
      return Response.json({
        success: true,
        businessId: invitation.businessId,
      });
    }

    if (invitation.status !== "pending") {
      return Response.json(
        { error: "Invitation is no longer pending" },
        { status: 400 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "expired" },
      });
      return Response.json(
        { error: "Invitation has expired" },
        { status: 400 },
      );
    }

    // Belonging to someone else's team is checked before ownership so the two
    // cases can't be confused: `businessId` pointing anywhere other than the
    // user's own business means they are already a member somewhere.
    if (
      currentUser.businessId &&
      currentUser.businessId !== currentUser.business?.id
    ) {
      return Response.json(
        { error: "You are already part of a team" },
        { status: 400 },
      );
    }

    // One business per user, so accepting means giving up ownership. That is
    // only allowed when the owned business is untouched, and never without
    // saying so first -- the confirmation round-trip is the whole point.
    let ownedBusinessId: string | null = null;
    if (currentUser.business) {
      const owned = await inspectOwnedBusiness(
        prisma,
        currentUser.business.id,
        session.user.id,
      );

      if (!owned) {
        return Response.json({ error: "Business not found" }, { status: 404 });
      }

      if (!owned.empty) {
        return Response.json(
          {
            error:
              "You already own a business with data in it. Invitations can only be accepted by an account that doesn't own one.",
            blockers: owned.blockers,
          },
          { status: 400 },
        );
      }

      if (confirmDeleteOwnedBusiness !== true) {
        return Response.json(
          {
            requiresConfirmation: true,
            ownedBusiness: { id: owned.id, name: owned.name },
            error: `Accepting will permanently delete "${owned.name}", the empty business you own.`,
          },
          { status: 409 },
        );
      }

      ownedBusinessId = owned.id;
    }

    // `onboardingCompleted` gates the whole app in middleware.ts. Joining a team
    // is the other way to finish onboarding -- without this the invitee is
    // bounced back to /onboarding forever, since business creation is closed to
    // them.
    //
    // Interactive transaction so a concurrent accept rolls the membership update
    // back instead of committing it alongside a no-op.
    try {
      await prisma.$transaction(
        async (tx) => {
          const accepted = await tx.invitation.updateMany({
            where: { id: invitation.id, status: "pending" },
            data: { status: "accepted" },
          });

          if (accepted.count === 0) {
            throw new ClaimConflictError("not_pending");
          }

          if (ownedBusinessId) {
            // Re-checked inside the transaction: the pre-flight above ran on a
            // separate connection and the owner could have added a task since.
            // The remaining window -- writing to their own business between this
            // check and the delete -- is left open deliberately; closing it
            // costs Serializable isolation plus 40001 retries on this hot path.
            const owned = await inspectOwnedBusiness(
              tx,
              ownedBusinessId,
              session.user.id,
            );

            if (!owned?.empty) {
              throw new ClaimConflictError(
                "owns_business",
                owned?.blockers ?? [],
              );
            }

            // Guarded by userId so a concurrent ownership change aborts the
            // whole accept instead of deleting a business that is no longer
            // theirs.
            const removed = await tx.business.deleteMany({
              where: { id: ownedBusinessId, userId: session.user.id },
            });

            if (removed.count !== 1) {
              throw new ClaimConflictError("not_pending");
            }
          }

          // Any request to join elsewhere is moot now.
          await tx.joinRequest.updateMany({
            where: { userId: session.user.id, status: "pending" },
            data: { status: "cancelled", pendingUserId: null },
          });

          // LAST write in the transaction, and it must stay last.
          //
          // `User.businessId -> Business.id` is onDelete: SetNull under the
          // default foreignKeys relation mode, so deleting the owned business
          // fires a real Postgres trigger clearing every user row pointing at
          // it. Set membership first and that trigger merely fails to match --
          // correctness resting on a side effect not noticing a row mutated
          // microseconds earlier. Move the delete out of this transaction later
          // and it would clear the membership instead, stranding the user with
          // businessId NULL *and* onboardingCompleted true, a state the
          // middleware onboarding gate never repairs. Deleting first makes the
          // ordering safe regardless of how the FK action is implemented.
          await tx.user.update({
            where: { id: session.user.id },
            data: {
              businessId: invitation.businessId,
              role: invitation.role,
              onboardingCompleted: true,
            },
          });
        },
        // The default 5s budget is tight now the callback also runs an
        // inspection query and a cascading delete.
        { timeout: 15_000 },
      );
    } catch (err) {
      if (err instanceof ClaimConflictError) {
        if (err.code === "owns_business") {
          return Response.json(
            {
              error:
                "Your business changed while you were accepting. Refresh and try again.",
              blockers: err.blockers,
            },
            { status: 409 },
          );
        }
        return Response.json(
          { error: "Invitation is no longer pending" },
          { status: 400 },
        );
      }
      throw err;
    }

    return Response.json({ success: true, businessId: invitation.businessId });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[team/accept-invite] failed:", err);
    return Response.json(
      { error: "Couldn't accept the invitation. Please try again." },
      { status: 500 },
    );
  }
}
