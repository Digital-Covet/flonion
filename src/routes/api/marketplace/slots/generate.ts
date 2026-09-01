import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

const MAX_RANGE_DAYS = 90;

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDayOfWeek(date: Date): number {
  return date.getDay();
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { startDate, endDate } = body;

    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return Response.json({ error: "Invalid date format" }, { status: 400 });
    }

    const diffMs = rangeEnd.getTime() - rangeStart.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > MAX_RANGE_DAYS) {
      return Response.json(
        { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      );
    }

    if (diffDays < 1) {
      return Response.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        workingDays: true,
        workingStartTime: true,
        workingEndTime: true,
        bookingStartTime: true,
        bookingEndTime: true,
        slotDuration: true,
      },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    const workingDays = business.workingDays
      .split(",")
      .map((d) => parseInt(d, 10))
      .filter((d) => !isNaN(d));

    const bookingStart = parseTime(business.bookingStartTime);
    const bookingEnd = parseTime(business.bookingEndTime);
    const duration = business.slotDuration;

    if (bookingStart >= bookingEnd) {
      return Response.json(
        { error: "Booking start time must be before end time" },
        { status: 400 },
      );
    }

    // Delete unbooked slots in the target range
    await prisma.availabilitySlot.deleteMany({
      where: {
        businessId: business.id,
        isBooked: false,
        date: { gte: rangeStart, lte: rangeEnd },
      },
    });

    // Generate new slots
    const newSlots: { businessId: string; date: Date; startTime: string; endTime: string }[] = [];
    const current = new Date(rangeStart);

    while (current <= rangeEnd) {
      const dayOfWeek = getDayOfWeek(current);

      if (workingDays.includes(dayOfWeek)) {
        let cursor = bookingStart;
        while (cursor + duration <= bookingEnd) {
          newSlots.push({
            businessId: business.id,
            date: new Date(current),
            startTime: formatTime(cursor),
            endTime: formatTime(cursor + duration),
          });
          cursor += duration;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    if (newSlots.length > 0) {
      await prisma.availabilitySlot.createMany({
        data: newSlots,
        skipDuplicates: true,
      });
    }

    return Response.json({ created: newSlots.length });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
