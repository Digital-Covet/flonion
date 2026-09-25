import { Effect } from "effect";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import { recoverUnexpected, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

export const GET = handler(
  "marketplace.slots.mine",
  Effect.gen(function* () {
    const session = yield* requireSession();
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

    const slots = yield* db.use((p) =>
      p.availabilitySlot.findMany({
        where: { businessId: business.id, date: { gte: new Date() } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          isBooked: true,
        },
      }),
    );
    return { slots };
  }).pipe(
    recoverUnexpected(
      new UpstreamError({ status: 500, message: "Failed to load slots" }),
      "[marketplace/slots/mine] query failed:",
    ),
  ),
);
