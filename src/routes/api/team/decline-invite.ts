import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

/**
 * Records that an invitee chose to create their own business instead of joining.
 *
 * Under the single-business model that decision is irreversible for this
 * account, so it is written down rather than dismissed client-side — otherwise
 * the invitation lingers as `pending` and the inviter never learns it was
 * turned down.
 */
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
      select: { id: true, email: true, status: true },
    });

    if (!invitation) {
      return Response.json({ error: "Invalid invitation" }, { status: 404 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (currentUser?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return Response.json(
        { error: "This invitation is for a different email address" },
        { status: 400 },
      );
    }

    // Already resolved one way or another — nothing to record, and no reason to
    // block the user from getting on with their own onboarding.
    if (invitation.status !== "pending") {
      return Response.json({ success: true, status: invitation.status });
    }

    await prisma.invitation.updateMany({
      where: { id: invitation.id, status: "pending" },
      data: { status: "declined" },
    });

    return Response.json({ success: true, status: "declined" });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
