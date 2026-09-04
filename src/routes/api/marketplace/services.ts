import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { getCompanyServices } from "~/lib/company-profile";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const businessId = url.searchParams.get("businessId");

  if (!businessId) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
  }

  try {
    const services = await getCompanyServices(businessId);

    return Response.json({ services });
  } catch (err) {
    console.error("[marketplace/services] query failed:", err);
    return Response.json({ error: "Failed to load services" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { businessId, services } = body;

    if (typeof businessId !== "string" || !businessId) {
      return Response.json({ error: "businessId is required" }, { status: 400 });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return Response.json(
        { error: "At least one service is required" },
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

    const created = await prisma.service.createMany({
      data: services.map((s: { icon: string; title: string; description: string; position?: number }) => ({
        businessId,
        icon: s.icon,
        title: s.title,
        description: s.description,
        position: s.position ?? 0,
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
    const updated = await prisma.service.update({
      where: { id, businessId },
      data: {
        icon: typeof data.icon === "string" ? data.icon : undefined,
        title: typeof data.title === "string" ? data.title : undefined,
        description:
          typeof data.description === "string" ? data.description : undefined,
        position: typeof data.position === "number" ? data.position : undefined,
      },
      select: {
        id: true,
        icon: true,
        title: true,
        description: true,
        position: true,
      },
    });

    return Response.json({ service: updated });
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

    await prisma.service.delete({ where: { id, businessId } });

    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
