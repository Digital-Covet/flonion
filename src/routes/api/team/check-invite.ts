import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { inspectOwnedBusiness } from "~/lib/empty-business";
import { getSessionFromHeaders } from "~/lib/server-auth";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      businessId: true,
      business: { select: { id: true } },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Members of someone else's team can't accept anything. Owners still can --
  // accept-invite offers to discard an untouched business for them -- so this
  // no longer short-circuits on `businessId` alone, which for an owner points at
  // the business they own.
  if (user.businessId && user.businessId !== user.business?.id) {
    return Response.json({ invitation: null, ownedBusiness: null });
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

  // Surfaced alongside the invitation so the UI can warn about the trade before
  // the user clicks accept, rather than after a 409 round-trip.
  const ownedBusiness =
    invitation && user.business
      ? await inspectOwnedBusiness(prisma, user.business.id, session.user.id)
      : null;

  return Response.json({ invitation, ownedBusiness });
}
