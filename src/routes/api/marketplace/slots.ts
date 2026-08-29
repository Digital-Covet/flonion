import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

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
    if (isNaN(targetDate.getTime())) {
      return Response.json({ error: "Invalid date parameter" }, { status: 400 });
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
    const body = await event.request.json();
    const { slots } = body;

    if (!Array.isArray(slots) || slots.length === 0) {
      return Response.json(
        { error: "At least one slot is required" },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    const created = await prisma.availabilitySlot.createMany({
      data: slots.map((slot: { date: string; startTime: string; endTime: string }) => ({
        businessId: business.id,
        date: new Date(slot.date),
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      skipDuplicates: true,
    });

    return Response.json({ created: created.count });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
