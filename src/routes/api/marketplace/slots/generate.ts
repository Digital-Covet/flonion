import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getSessionFromHeaders } from "~/lib/server-auth";

const MAX_RANGE_DAYS = 90;
const VALID_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Slot dates are stored as midnight UTC, so the weekday has to be read in UTC
 * too — `getDay()` would name the day before on a server west of UTC.
 */
function getDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { startDate, endDate, days } = body;

    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return Response.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    /**
     * Optional day picker. Absent means "the business's working days", which
     * is what this endpoint has always done; a list opens exactly those
     * weekdays, so a one-off Saturday needs no change to the saved settings.
     */
    let chosenDays: number[] | null = null;
    if (days !== undefined) {
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        !days.every((d: unknown) => typeof d === "number" && VALID_DAYS.has(d))
      ) {
        return Response.json(
          { error: "days must be a non-empty array of day numbers (0-6)" },
          { status: 400 },
        );
      }
      chosenDays = [...new Set(days as number[])];
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime())
    ) {
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
      return Response.json(
        { error: "endDate must be after startDate" },
        { status: 400 },
      );
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
      .filter((d) => !Number.isNaN(d));

    const bookingStart = parseTime(business.bookingStartTime);
    const bookingEnd = parseTime(business.bookingEndTime);
    const duration = business.slotDuration;

    if (bookingStart >= bookingEnd) {
      return Response.json(
        { error: "Booking start time must be before end time" },
        { status: 400 },
      );
    }

    const targetDays = chosenDays ?? workingDays;

    // The days this run will fill, as the midnight-UTC instants slots are
    // stored at.
    const targetDates: Date[] = [];
    const current = new Date(rangeStart);
    while (current <= rangeEnd) {
      if (targetDays.includes(getDayOfWeek(current))) {
        targetDates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Clearing is scoped to what is about to be rebuilt: picking Wednesday
    // only must not wipe the free slots already open on Monday. Without a day
    // picker the whole range is rebuilt, as this endpoint always did.
    await prisma.availabilitySlot.deleteMany({
      where: {
        businessId: business.id,
        isBooked: false,
        ...(chosenDays
          ? { date: { in: targetDates } }
          : { date: { gte: rangeStart, lte: rangeEnd } }),
      },
    });

    const newSlots: {
      businessId: string;
      date: Date;
      startTime: string;
      endTime: string;
    }[] = [];

    for (const date of targetDates) {
      let cursor = bookingStart;
      while (cursor + duration <= bookingEnd) {
        newSlots.push({
          businessId: business.id,
          date,
          startTime: formatTime(cursor),
          endTime: formatTime(cursor + duration),
        });
        cursor += duration;
      }
    }

    if (newSlots.length > 0) {
      await prisma.availabilitySlot.createMany({
        data: newSlots,
        skipDuplicates: true,
      });
    }

    return Response.json({ created: newSlots.length });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
