import { Effect, Option } from "effect";
import { BadRequest } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireMemberBusinessId,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import { Google } from "~/server/effect/services/google";

export const GET = handler(
  "team-meetings.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const businessId = yield* requireMemberBusinessId(session.user.id);

    const { url } = yield* RequestContext;
    const dateParam = url.searchParams.get("date");

    let date: { gte: Date; lte: Date } | undefined;
    if (dateParam) {
      const day = new Date(dateParam);
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      date = { gte: startOfDay, lte: endOfDay };
    }

    const db = yield* Db;
    return yield* db.use((p) =>
      p.teamMeeting.findMany({
        where: { businessId, ...(date ? { date } : {}) },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
    );
  }),
);

const REQUIRED_FIELDS = [
  ["date", "Date is required"],
  ["startTime", "Start time is required"],
  ["endTime", "End time is required"],
] as const;

export const POST = handler(
  "team-meetings.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const businessId = yield* requireMemberBusinessId(session.user.id);

    return yield* Effect.gen(function* () {
      const body = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      const { title, date, startTime, endTime, location } = body;

      if (typeof title !== "string" || !title.trim()) {
        return yield* new BadRequest({ message: "Title is required" });
      }
      for (const [field, message] of REQUIRED_FIELDS) {
        const value = body[field];
        if (typeof value !== "string" || !value) {
          return yield* new BadRequest({ message });
        }
      }
      if (typeof location !== "string" || !location.trim()) {
        return yield* new BadRequest({ message: "Location is required" });
      }

      const db = yield* Db;
      const meeting = yield* db.use((p) =>
        p.teamMeeting.create({
          data: {
            title: title.trim(),
            date: new Date(date as string),
            startTime: startTime as string,
            endTime: endTime as string,
            location: location.trim(),
            businessId,
          },
        }),
      );

      // A Google Meet link is a bonus: the meeting is already saved without
      // one, and `createMeetLink` never fails, only comes back empty.
      const google = yield* Google;
      const meetLink = yield* google.createMeetLink(session.user.id);
      if (Option.isSome(meetLink)) {
        const { meetUri, spaceId } = meetLink.value;
        yield* db.use((p) =>
          p.teamMeeting.update({
            where: { id: meeting.id },
            data: { meetUri, meetSpaceId: spaceId },
          }),
        );
        meeting.meetUri = meetUri;
        meeting.meetSpaceId = spaceId;
      }

      return Response.json(meeting, { status: 201 });
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
