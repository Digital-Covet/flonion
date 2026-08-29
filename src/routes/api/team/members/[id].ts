import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { isValidRole } from "~/lib/roles";
import { getBusinessContext, canManageTeam } from "~/lib/business-context";

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  if (!canManageTeam(ctx)) {
    return Response.json({ error: "Only admins or the business owner can update member roles" }, { status: 403 });
  }

  const memberId = event.params.id;

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { businessId: true, business: { select: { id: true } } },
  });

  if (!member || member.businessId !== ctx.businessId) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  if (member.business?.id === ctx.businessId) {
    return Response.json({ error: "The business owner cannot be modified" }, { status: 400 });
  }

  try {
    const body = await event.request.json();
    const { role } = body;

    if (typeof role !== "string" || !isValidRole(role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: memberId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

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
    return Response.json({ error: "Only admins or the business owner can remove members" }, { status: 403 });
  }

  const memberId = event.params.id;

  if (memberId === session.user.id) {
    return Response.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { businessId: true, business: { select: { id: true } } },
  });

  if (!member || member.businessId !== ctx.businessId) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  if (member.business?.id === ctx.businessId) {
    return Response.json({ error: "The business owner cannot be modified" }, { status: 400 });
  }

  // Clearing `businessId` alone would strand them in an empty app: middleware
  // only routes to /onboarding on `onboardingCompleted === false`, and that is
  // where they can now create a business of their own.
  await prisma.user.update({
    where: { id: memberId },
    data: { businessId: null, role: "member", onboardingCompleted: false },
  });

  return Response.json({ success: true });
}
