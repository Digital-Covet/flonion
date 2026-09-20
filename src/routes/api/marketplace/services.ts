import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/db/prisma";
import { getCompanyServices } from "~/lib/company-profile";
import {
  MAX_BULK_ITEMS,
  MAX_LONG_FIELD,
  MAX_SHORT_FIELD,
  oversizedFieldResponse,
} from "~/lib/input-limits";
import { getSessionFromHeaders } from "~/lib/server-auth";

/**
 * Bounds the array and each field, and enforces at runtime the shape the old
 * `services.map((s: { icon: string, ... }) => ...)` only asserted. These rows
 * are read back on every company profile render.
 */
const createServicesSchema = z.object({
  businessId: z.string().min(1),
  services: z
    .array(
      z.object({
        icon: z.string().trim().max(MAX_SHORT_FIELD),
        title: z.string().trim().max(MAX_SHORT_FIELD),
        description: z.string().trim().max(MAX_LONG_FIELD),
        position: z.number().int().min(0).max(10_000).optional(),
      }),
    )
    .min(1)
    .max(MAX_BULK_ITEMS),
});

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
    const parsed = createServicesSchema.safeParse(await event.request.json());

    if (!parsed.success) {
      return Response.json(
        {
          error: `Between 1 and ${MAX_BULK_ITEMS} valid services are required`,
        },
        { status: 400 },
      );
    }

    const { businessId, services } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const created = await prisma.service.createMany({
      data: services.map((s) => ({
        businessId,
        icon: s.icon,
        title: s.title,
        description: s.description,
        position: s.position ?? 0,
      })),
    });

    return Response.json({ created: created.count });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
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
      return Response.json(
        { error: "businessId is required" },
        { status: 400 },
      );
    }

    const tooLong = oversizedFieldResponse([
      { label: "Icon", value: data.icon, max: MAX_SHORT_FIELD },
      { label: "Title", value: data.title, max: MAX_SHORT_FIELD },
      { label: "Description", value: data.description, max: MAX_LONG_FIELD },
    ]);
    if (tooLong) return tooLong;

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
    return Response.json({ error: "Invalid request body" }, { status: 400 });
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
      return Response.json(
        { error: "businessId is required" },
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

    await prisma.service.delete({ where: { id, businessId } });

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
