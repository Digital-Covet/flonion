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
    select: { email: true, businessId: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // If user already has a business, they don't need to accept an invite
  if (user.businessId) {
    return Response.json({ invitation: null });
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      email: user.email.toLowerCase(),
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      token: true,
      role: true,
      business: {
        select: { name: true },
      },
      invitedBy: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ invitation });
}
