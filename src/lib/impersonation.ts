import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";

/**
 * Who the current session impersonates, or null. `Session.impersonatedBy` is
 * not part of the client session payload, so it is read on the server.
 */
export const getImpersonation = query(async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) return null;

  const { getSessionFromHeaders } = await import("~/lib/server-auth");
  const { prisma } = await import("~/db/prisma");

  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) return null;

  const row = await prisma.session.findUnique({
    where: { id: session.session.id },
    select: { impersonatedBy: true },
  });
  if (!row?.impersonatedBy) return null;

  return { name: session.user.name || session.user.email };
}, "impersonation");
