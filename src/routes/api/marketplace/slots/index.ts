import { Effect, Schema } from "effect";
import { MAX_BULK_SLOTS } from "~/lib/input-limits";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import {
  decodeJsonBody,
  recoverAll,
  recoverUnexpected,
  requireQueryParam,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const HourMinute = Schema.Trim.pipe(
  Schema.check(Schema.isPattern(/^\d{2}:\d{2}$/)),
);

/**
 * Slots are published a month at a time, hence the larger ceiling than the
 * other bulk endpoints. `date` was once fed to `new Date()` untyped, so a
 * non-date reached Prisma as `Invalid Date`; it is decoded here instead,
 * from a date string or epoch milliseconds, as Zod's `coerce.date` allowed.
 */
const CreateSlots = Schema.Struct({
  slots: Schema.Array(
    Schema.Struct({
      date: Schema.Union([Schema.DateFromString, Schema.DateFromMillis]),
      startTime: HourMinute,
      endTime: HourMinute,
    }),
  ).pipe(Schema.check(Schema.isLengthBetween(1, MAX_BULK_SLOTS))),
});

const slotSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  isBooked: true,
} as const;

export const GET = handler(
  "marketplace.slots.list",
  Effect.gen(function* () {
    const businessId = yield* requireQueryParam(
      "businessId",
      "businessId is required",
    );
    const { url } = yield* RequestContext;
    const dateParam = url.searchParams.get("date");

    let date: { gte: Date; lte?: Date } = { gte: new Date() };
    if (dateParam) {
      const targetDate = new Date(dateParam);
      if (Number.isNaN(targetDate.getTime())) {
        return yield* new BadRequest({ message: "Invalid date parameter" });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      date = { gte: startOfDay, lte: endOfDay };
    }

    const db = yield* Db;
    const slots = yield* db
      .use((p) =>
        p.availabilitySlot.findMany({
          where: { businessId, isBooked: false, date },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: slotSelect,
        }),
      )
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            console.error("[marketplace/slots] query failed:", cause),
          ),
        ),
        recoverAll(
          new UpstreamError({ status: 500, message: "Failed to load slots" }),
        ),
      );
    return { slots };
  }),
);

export const POST = handler(
  "marketplace.slots.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { slots } = yield* decodeJsonBody(
      CreateSlots,
      () =>
        new BadRequest({
          message: `Between 1 and ${MAX_BULK_SLOTS} valid slots are required`,
        }),
    );

    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }),
    );
    if (!business) {
      return yield* new BadRequest({ message: "No business found" });
    }

    const created = yield* db.use((p) =>
      p.availabilitySlot.createMany({
        data: slots.map((slot) => ({
          businessId: business.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
        skipDuplicates: true,
      }),
    );
    return { created: created.count };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);
