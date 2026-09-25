import { Effect } from "effect";
import { BadRequest, Forbidden, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireMemberBusinessId,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const meetingId = RequestContext.use(({ params }) => Effect.succeed(params.id));

/** The meeting, if it belongs to the caller's team; otherwise a 404. */
const requireOwnMeeting = Effect.fn("requireOwnMeeting")(function* (
  userId: string,
  id: string,
) {
  const businessId = yield* requireMemberBusinessId(userId);
  const db = yield* Db;
  const existing = yield* db.use((p) =>
    p.teamMeeting.findUnique({ where: { id }, select: { businessId: true } }),
  );
  if (!existing || existing.businessId !== businessId) {
    return yield* new NotFound({ message: "Meeting not found" });
  }
});

export const GET = handler(
  "team-meetings.get",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const id = yield* meetingId;

    const db = yield* Db;
    const meeting = yield* db.use((p) =>
      p.teamMeeting.findUnique({ where: { id } }),
    );
    if (!meeting) return yield* new NotFound({ message: "Meeting not found" });

    const user = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: { businessId: true },
      }),
    );
    if (!user?.businessId || meeting.businessId !== user.businessId) {
      return yield* new Forbidden({ message: "Forbidden" });
    }
    return meeting;
  }),
);

export const PATCH = handler(
  "team-meetings.update",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const id = yield* meetingId;
    yield* requireOwnMeeting(session.user.id, id);

    return yield* Effect.gen(function* () {
      const { title, date, startTime, endTime, location } =
        yield* readJsonObject(
          () => new BadRequest({ message: "Invalid request body" }),
        );

      const data: Record<string, unknown> = {};
      if (typeof title === "string" && title.trim()) data.title = title.trim();
      if (typeof date === "string" && date) data.date = new Date(date);
      if (typeof startTime === "string" && startTime) {
        data.startTime = startTime;
      }
      if (typeof endTime === "string" && endTime) data.endTime = endTime;
      if (typeof location === "string" && location.trim()) {
        data.location = location.trim();
      }

      const db = yield* Db;
      return yield* db.use((p) =>
        p.teamMeeting.update({ where: { id }, data }),
      );
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);

export const DELETE = handler(
  "team-meetings.delete",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const id = yield* meetingId;
    yield* requireOwnMeeting(session.user.id, id);

    const db = yield* Db;
    yield* db.use((p) => p.teamMeeting.delete({ where: { id } }));
    return { success: true };
  }),
);
