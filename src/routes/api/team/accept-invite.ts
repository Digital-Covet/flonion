import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { token } = body;

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
      return Response.json({ error: "This invitation is for a different email address" }, { status: 400 });
    }

    // Re-clicking the link after a successful accept should be a no-op, not an
    // error, so the membership check runs before the status check.
    if (currentUser.businessId === invitation.businessId) {
      return Response.json({ success: true, businessId: invitation.businessId });
    }

    if (invitation.status !== "pending") {
      return Response.json({ error: "Invitation is no longer pending" }, { status: 400 });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "expired" },
      });
      return Response.json({ error: "Invitation has expired" }, { status: 400 });
    }

    // One business per user: an owner cannot also join someone else's team.
    // Accepting would orphan their own business and leave `business` and
    // `businessId` pointing at different rows.
    if (currentUser.business) {
      return Response.json(
        {
          error:
            "You already own a business. Invitations can only be accepted by an account that doesn't own one.",
        },
        { status: 400 },
      );
    }

    if (currentUser.businessId) {
      return Response.json({ error: "You are already part of a team" }, { status: 400 });
    }

    // `onboardingCompleted` gates the whole app in middleware.ts. Joining a team
    // is the other way to finish onboarding — without this the invitee is bounced
    // back to /onboarding forever, since business creation is closed to them.
    //
    // Interactive transaction so a concurrent accept (count === 0) rolls the
    // membership update back instead of committing it alongside a no-op.
    const claimed = await prisma.$transaction(async (tx) => {
      const accepted = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "pending" },
        data: { status: "accepted" },
      });

      if (accepted.count === 0) return false;

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          businessId: invitation.businessId,
          role: invitation.role,
          onboardingCompleted: true,
        },
      });

      return true;
    });

    if (!claimed) {
      return Response.json({ error: "Invitation is no longer pending" }, { status: 400 });
    }

    return Response.json({ success: true, businessId: invitation.businessId });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
