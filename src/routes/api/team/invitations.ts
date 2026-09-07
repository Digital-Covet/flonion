import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import { getSessionFromHeaders } from "~/lib/server-auth";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  // Pending invitee addresses are management data, and this listing is only
  // consumed by the admin-gated section of the team settings page.
  if (!canManageTeam(ctx)) {
    return Response.json(
      { error: "Only admins or the business owner can view invitations" },
      { status: 403 },
    );
  }

  // Declined invites are listed alongside pending ones so the inviter sees the
  // outcome instead of watching an invitation that will never resolve.
  const invitations = await prisma.invitation.findMany({
    where: {
      businessId: ctx.businessId,
      status: { in: ["pending", "declined"] },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(invitations);
}
