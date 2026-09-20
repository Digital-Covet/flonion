import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/db/prisma";
import { getCompanyContacts } from "~/lib/company-profile";
import {
  MAX_BULK_ITEMS,
  MAX_SHORT_FIELD,
  oversizedFieldResponse,
} from "~/lib/input-limits";
import { imageSrc } from "~/lib/safe-url";
import { getSessionFromHeaders } from "~/lib/server-auth";

/**
 * The hand-written `contacts.map((c: { name: string, ... }) => ...)` this
 * replaces was a type assertion TypeScript erases at runtime: a non-string
 * `name` reached Prisma, and nothing bounded the array or the strings. Rows
 * created here are read back on every company profile render.
 */
const createContactsSchema = z.object({
  businessId: z.string().min(1),
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(MAX_SHORT_FIELD),
        role: z.string().trim().max(MAX_SHORT_FIELD),
        avatarUrl: z
          .string()
          .transform((value) => imageSrc(value))
          .nullable()
          .optional(),
        email: z.string().trim().max(MAX_SHORT_FIELD).nullable().optional(),
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
    const contacts = await getCompanyContacts(businessId);

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
    const parsed = createContactsSchema.safeParse(await event.request.json());

    if (!parsed.success) {
      return Response.json(
        {
          error: `Between 1 and ${MAX_BULK_ITEMS} valid contacts are required`,
        },
        { status: 400 },
      );
    }

    const { businessId, contacts } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const created = await prisma.businessContact.createMany({
      data: contacts.map((c) => ({
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
      { label: "Name", value: data.name, max: MAX_SHORT_FIELD },
      { label: "Role", value: data.role, max: MAX_SHORT_FIELD },
      { label: "Email", value: data.email, max: MAX_SHORT_FIELD },
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
    const updated = await prisma.businessContact.update({
      where: { id, businessId },
      data: {
        name: typeof data.name === "string" ? data.name : undefined,
        role: typeof data.role === "string" ? data.role : undefined,
        // Rendered into `<img src>` on the public profile, so it goes through
        // the same gate as the logo. A non-string (the client sends `null`)
        // leaves the stored value alone, as before.
        avatarUrl:
          typeof data.avatarUrl === "string"
            ? imageSrc(data.avatarUrl)
            : undefined,
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

    await prisma.businessContact.delete({ where: { id, businessId } });

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
