import { Effect, Schema } from "effect";
import { BadRequest } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const MAX_RANGE_DAYS = 90;

/** A non-empty list of weekday numbers, 0 (Sunday) to 6. */
const DayPicker = Schema.Array(Schema.Literals([0, 1, 2, 3, 4, 5, 6])).pipe(
  Schema.check(Schema.isMinLength(1)),
);

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

export const POST = handler(
  "marketplace.slots.generate",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    const { startDate, endDate, days } = body;

    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return yield* new BadRequest({
        message: "startDate and endDate are required",
      });
    }

    /**
     * Optional day picker. Absent means "the business's working days", which
     * is what this endpoint has always done; a list opens exactly those
     * weekdays, so a one-off Saturday needs no change to the saved settings.
     */
    let chosenDays: number[] | null = null;
    if (days !== undefined) {
      if (!Schema.is(DayPicker)(days)) {
        return yield* new BadRequest({
          message: "days must be a non-empty array of day numbers (0-6)",
        });
      }
      chosenDays = [...new Set(days)];
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime())
    ) {
      return yield* new BadRequest({ message: "Invalid date format" });
    }

    const diffMs = rangeEnd.getTime() - rangeStart.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_RANGE_DAYS) {
      return yield* new BadRequest({
        message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      });
    }
    if (diffDays < 1) {
      return yield* new BadRequest({
        message: "endDate must be after startDate",
      });
    }

    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
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
      }),
    );
    if (!business) {
      return yield* new BadRequest({ message: "No business found" });
    }

    const workingDays = business.workingDays
      .split(",")
      .map((d) => parseInt(d, 10))
      .filter((d) => !Number.isNaN(d));

    const bookingStart = parseTime(business.bookingStartTime);
    const bookingEnd = parseTime(business.bookingEndTime);
    const duration = business.slotDuration;

    if (bookingStart >= bookingEnd) {
      return yield* new BadRequest({
        message: "Booking start time must be before end time",
      });
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
    yield* db.use((p) =>
      p.availabilitySlot.deleteMany({
        where: {
          businessId: business.id,
          isBooked: false,
          ...(chosenDays
            ? { date: { in: targetDates } }
            : { date: { gte: rangeStart, lte: rangeEnd } }),
        },
      }),
    );

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
      yield* db.use((p) =>
        p.availabilitySlot.createMany({ data: newSlots, skipDuplicates: true }),
      );
    }

    return { created: newSlots.length };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);
