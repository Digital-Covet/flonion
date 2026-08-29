import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  // Declined invites are listed alongside pending ones so the inviter sees the
  // outcome instead of watching an invitation that will never resolve.
  const invitations = await prisma.invitation.findMany({
    where: {
      businessId: user.businessId,
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
