import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import { getSessionFromHeaders } from "~/lib/server-auth";

/** How long a resolved request stays visible in the queue. */
const RESOLVED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_ROWS = 100;

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  // Unlike the older team listings, this one is gated: it exposes the email
  // addresses of people who are not (yet) members.
  if (!canManageTeam(ctx)) {
    return Response.json(
      { error: "Only admins or the business owner can view join requests" },
      { status: 403 },
    );
  }

  // Resolved rows are listed alongside pending ones for the same reason
  // /api/team/invitations returns declined invites -- an admin should see the
  // outcome rather than watch a row disappear.
  const joinRequests = await prisma.joinRequest.findMany({
    where: {
      businessId: ctx.businessId,
      OR: [
        { status: "pending" },
        { reviewedAt: { gt: new Date(Date.now() - RESOLVED_WINDOW_MS) } },
      ],
    },
    select: {
      id: true,
      message: true,
      status: true,
      grantedRole: true,
      createdAt: true,
      reviewedAt: true,
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      reviewedBy: {
        select: { name: true, email: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: MAX_ROWS,
  });

  return Response.json(joinRequests);
}
