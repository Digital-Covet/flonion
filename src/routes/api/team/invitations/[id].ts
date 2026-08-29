import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { getBusinessContext, canManageTeam } from "~/lib/business-context";

export async function DELETE(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  if (!canManageTeam(ctx)) {
    return Response.json({ error: "Only admins or the business owner can cancel invitations" }, { status: 403 });
  }

  const invitationId = event.params.id;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { businessId: true, status: true },
  });

  if (!invitation || invitation.businessId !== ctx.businessId) {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return Response.json({ error: "Invitation is not pending" }, { status: 400 });
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "cancelled" },
  });

  return Response.json({ success: true });
}
