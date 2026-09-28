import { Effect } from "effect";
import { BadRequest, Forbidden, NotFound } from "~/server/effect/errors";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const IMPERSONATION_MESSAGE =
  "Devices can't be logged out while you're viewing as this user";

/** Log out one of the caller's other devices. */
export const DELETE = handler(
  "account.sessions.revoke",
  Effect.gen(function* () {
    const session = yield* requireSession();
    if (session.session.impersonatedBy) {
      return yield* new Forbidden({ message: IMPERSONATION_MESSAGE });
    }

    const { params } = yield* RequestContext;
    const sessionId = params.id;
    if (!sessionId) {
      return yield* new BadRequest({ message: "Session id is required" });
    }
    if (sessionId === session.session.id) {
      return yield* new BadRequest({
        message: "Use Log out to end this session",
      });
    }

    // Scoped to the caller, so another user's session id is simply not found.
    const db = yield* Db;
    const { count } = yield* db.use((p) =>
      p.session.deleteMany({
        where: { id: sessionId, userId: session.user.id, impersonatedBy: null },
      }),
    );
    if (count === 0) {
      return yield* new NotFound({ message: "Session not found" });
    }
    return { success: true };
  }),
);
