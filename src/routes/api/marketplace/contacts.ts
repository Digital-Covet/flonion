import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const businessId = url.searchParams.get("businessId");

  if (!businessId) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
  }

  try {
    const contacts = await prisma.businessContact.findMany({
      where: { businessId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        email: true,
        position: true,
      },
    });

    return Response.json({ contacts });
  } catch (err) {
    console.error("[marketplace/contacts] query failed:", err);
    return Response.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { businessId, contacts } = body;

    if (typeof businessId !== "string" || !businessId) {
      return Response.json({ error: "businessId is required" }, { status: 400 });
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return Response.json(
        { error: "At least one contact is required" },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const created = await prisma.businessContact.createMany({
      data: contacts.map((c: { name: string; role: string; avatarUrl?: string; email?: string; position?: number }) => ({
        businessId,
        name: c.name,
        role: c.role,
        avatarUrl: c.avatarUrl ?? null,
        email: c.email ?? null,
        position: c.position ?? 0,
      })),
    });

    return Response.json({ created: created.count });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { id, businessId, ...data } = body;

    if (typeof id !== "string" || !id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    if (typeof businessId !== "string" || !businessId) {
      return Response.json({ error: "businessId is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Scoped to the business the caller was just authorized for. Matching on
    // `id` alone let an owner pass their own `businessId` past the check above
    // and then edit a row belonging to someone else.
    const updated = await prisma.businessContact.update({
      where: { id, businessId },
      data: {
        name: typeof data.name === "string" ? data.name : undefined,
        role: typeof data.role === "string" ? data.role : undefined,
        avatarUrl:
          typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        position: typeof data.position === "number" ? data.position : undefined,
      },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        email: true,
        position: true,
      },
    });

    return Response.json({ contact: updated });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

export async function DELETE(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { id, businessId } = body;

    if (typeof id !== "string" || !id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    if (typeof businessId !== "string" || !businessId) {
      return Response.json({ error: "businessId is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.businessContact.delete({ where: { id, businessId } });

    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
