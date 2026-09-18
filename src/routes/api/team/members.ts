import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getSessionFromHeaders } from "~/lib/server-auth";

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

  const members = await prisma.user.findMany({
    where: { businessId: user.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      // Ownership is a different link from membership (see business-context):
      // `Business.userId` owns, `User.businessId` belongs. Without it the team
      // page can't tell which row is the owner, and would offer a role select
      // and a Remove button that /api/team/members/[id] answers 400 to.
      business: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(
    members.map(({ business, ...member }) => ({
      ...member,
      isOwner: business?.id === user.businessId,
    })),
  );
}
