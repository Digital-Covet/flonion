import { Effect, Schema } from "effect";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverAll,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const Time = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^([01]\d|2[0-3]):([0-5]\d)$/)),
);
const WorkingDays = Schema.Array(Schema.Literals([0, 1, 2, 3, 4, 5, 6]));
const SlotDuration = Schema.Literals([15, 30, 45, 60]);

/** Checked in this order, so the first bad field names itself as before. */
const TIME_FIELDS = [
  "workingStartTime",
  "workingEndTime",
  "bookingStartTime",
  "bookingEndTime",
] as const;

const noBusiness = new BadRequest({ message: "No business found" });

export const GET = handler(
  "marketplace.schedule-settings.get",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;
    const settings = yield* db
      .use((p) =>
        p.business.findUnique({
          where: { userId: session.user.id },
          select: {
            workingDays: true,
            workingStartTime: true,
            workingEndTime: true,
            bookingStartTime: true,
            bookingEndTime: true,
            slotDuration: true,
            timezone: true,
            username: true,
          },
        }),
      )
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            console.error("[schedule-settings] GET failed:", cause),
          ),
        ),
        recoverAll(
          new UpstreamError({
            status: 500,
            message: "Failed to load settings",
          }),
        ),
      );

    if (!settings) return yield* noBusiness;
    return { settings };
  }),
);

export const PUT = handler(
  "marketplace.schedule-settings.update",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );

    const updates: Record<string, string | number> = {};

    if (body.workingDays !== undefined) {
      if (!Schema.is(WorkingDays)(body.workingDays)) {
        return yield* new BadRequest({
          message: "workingDays must be an array of day numbers (0-6)",
        });
      }
      updates.workingDays = body.workingDays.join(",");
    }

    for (const field of TIME_FIELDS) {
      const value = body[field];
      if (value === undefined) continue;
      if (!Schema.is(Time)(value)) {
        return yield* new BadRequest({
          message: `${field} must be HH:MM format`,
        });
      }
      updates[field] = value;
    }

    if (body.slotDuration !== undefined) {
      if (!Schema.is(SlotDuration)(body.slotDuration)) {
        return yield* new BadRequest({
          message: "slotDuration must be 15, 30, 45, or 60",
        });
      }
      updates.slotDuration = body.slotDuration;
    }

    if (Object.keys(updates).length === 0) {
      return yield* new BadRequest({ message: "No fields to update" });
    }

    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }),
    );
    if (!business) return yield* noBusiness;

    yield* db.use((p) =>
      p.business.update({ where: { id: business.id }, data: updates }),
    );
    return { ok: true };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);
