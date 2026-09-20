import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/db/prisma";
import { MAX_BULK_SLOTS } from "~/lib/input-limits";
import { getSessionFromHeaders } from "~/lib/server-auth";

/**
 * Slots are published a month at a time, hence the larger ceiling than the
 * other bulk endpoints. `date` was previously fed to `new Date()` untyped, so
 * a non-date reached Prisma as `Invalid Date`.
 */
const createSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        date: z.coerce.date(),
        startTime: z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/),
        endTime: z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1)
    .max(MAX_BULK_SLOTS),
});

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const businessId = url.searchParams.get("businessId");
  const dateParam = url.searchParams.get("date");

  if (!businessId) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
  }

  const now = new Date();
  const where: Record<string, unknown> = {
    businessId,
    isBooked: false,
    date: { gte: now },
  };

  if (dateParam) {
    const targetDate = new Date(dateParam);
    if (Number.isNaN(targetDate.getTime())) {
      return Response.json(
        { error: "Invalid date parameter" },
        { status: 400 },
      );
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    where.date = { gte: startOfDay, lte: endOfDay };
  }

  try {
    const slots = await prisma.availabilitySlot.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isBooked: true,
      },
    });

    return Response.json({ slots });
  } catch (err) {
    console.error("[marketplace/slots] query failed:", err);
    return Response.json({ error: "Failed to load slots" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createSlotsSchema.safeParse(await event.request.json());

    if (!parsed.success) {
      return Response.json(
        { error: `Between 1 and ${MAX_BULK_SLOTS} valid slots are required` },
        { status: 400 },
      );
    }

    const { slots } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    const created = await prisma.availabilitySlot.createMany({
      data: slots.map((slot) => ({
        businessId: business.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      skipDuplicates: true,
    });

    return Response.json({ created: created.count });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
