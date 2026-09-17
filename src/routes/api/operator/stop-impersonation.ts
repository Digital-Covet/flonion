import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getSessionFromHeaders } from "~/lib/server-auth";

/**
 * Stop impersonation — destroys the impersonated session and redirects
 * the operator back to the desk.
 *
 * When Session.impersonatedBy is set, we know this is an impersonated
 * session. Deleting it and redirecting to the desk effectively "returns"
 * the operator to their own console.
 */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);

  if (!session) {
    return new Response(null, { status: 302, headers: { Location: "/login" } });
  }

  // Check if this session is impersonated
  const sessionRow = await prisma.session.findUnique({
    where: { id: session.session.id },
    select: { impersonatedBy: true },
  });

  if (!sessionRow?.impersonatedBy) {
    // Not impersonated — just redirect to dashboard
    return new Response(null, {
      status: 302,
      headers: { Location: "/dashboard" },
    });
  }

  // Delete the impersonated session
  await prisma.session.delete({ where: { id: session.session.id } });

  // Redirect to the desk console
  const deskUrl = process.env.DESK_APP_URL ?? "http://localhost:5174";
  return new Response(null, {
    status: 302,
    headers: { Location: deskUrl },
  });
}
