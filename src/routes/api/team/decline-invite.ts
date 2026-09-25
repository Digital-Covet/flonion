import { Effect, Schema } from "effect";
import { BadRequest, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

/**
 * Records that an invitee chose to create their own business instead of joining.
 *
 * Under the single-business model that decision is irreversible for this
 * account, so it is written down rather than dismissed client-side — otherwise
 * the invitation lingers as `pending` and the inviter never learns it was
 * turned down.
 */
export const POST = handler(
  "team.decline-invite",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { token } = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    if (!Schema.is(Schema.NonEmptyString)(token)) {
      return yield* new BadRequest({ message: "Token is required" });
    }

    const db = yield* Db;
    const invitation = yield* db.use((p) =>
      p.invitation.findUnique({
        where: { token },
        select: { id: true, email: true, status: true },
      }),
    );
    if (!invitation) {
      return yield* new NotFound({ message: "Invalid invitation" });
    }

    const currentUser = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      }),
    );
    if (currentUser?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return yield* new BadRequest({
        message: "This invitation is for a different email address",
      });
    }

    // Already resolved one way or another — nothing to record, and no reason
    // to block the user from getting on with their own onboarding.
    if (invitation.status !== "pending") {
      return { success: true, status: invitation.status };
    }

    yield* db.use((p) =>
      p.invitation.updateMany({
        where: { id: invitation.id, status: "pending" },
        data: { status: "declined" },
      }),
    );
    return { success: true, status: "declined" };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);
