import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/db/prisma";
import { getCompanyProjects } from "~/lib/company-profile";
import {
  MAX_BULK_ITEMS,
  MAX_MEDIUM_FIELD,
  oversizedFieldResponse,
} from "~/lib/input-limits";
import { imageSrc } from "~/lib/safe-url";
import { getSessionFromHeaders } from "~/lib/server-auth";

/**
 * Replaces a `projects.map((p: { imageUrl: string, ... }) => ...)` type
 * assertion TypeScript erased at runtime, and bounds both the array and each
 * field. `imageUrl` is rendered into `<img src>` on the public profile, so it
 * goes through the same gate as the logo rather than being stored as typed.
 */
const createProjectsSchema = z.object({
  businessId: z.string().min(1),
  projects: z
    .array(
      z.object({
        imageUrl: z
          .string()
          .refine((value) => imageSrc(value) !== null, {
            message: "Image must be a full http(s) link or an inline image",
          })
          .transform((value) => imageSrc(value) as string),
        altText: z.string().trim().max(MAX_MEDIUM_FIELD),
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
    const projects = await getCompanyProjects(businessId);

    return Response.json({ projects });
  } catch (err) {
    console.error("[marketplace/projects] query failed:", err);
    return Response.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createProjectsSchema.safeParse(await event.request.json());

    if (!parsed.success) {
      return Response.json(
        {
          error: `Between 1 and ${MAX_BULK_ITEMS} valid projects are required`,
        },
        { status: 400 },
      );
    }

    const { businessId, projects } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });

    if (!business || business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const created = await prisma.project.createMany({
      data: projects.map((p) => ({
        businessId,
        imageUrl: p.imageUrl,
        altText: p.altText,
        position: p.position ?? 0,
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
      { label: "Alt text", value: data.altText, max: MAX_MEDIUM_FIELD },
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
    const updated = await prisma.project.update({
      where: { id, businessId },
      data: {
        imageUrl:
          typeof data.imageUrl === "string"
            ? (imageSrc(data.imageUrl) ?? undefined)
            : undefined,
        altText: typeof data.altText === "string" ? data.altText : undefined,
        position: typeof data.position === "number" ? data.position : undefined,
      },
      select: {
        id: true,
        imageUrl: true,
        altText: true,
        position: true,
      },
    });

    return Response.json({ project: updated });
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

    await prisma.project.delete({ where: { id, businessId } });

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
