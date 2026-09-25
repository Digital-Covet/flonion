import { Effect } from "effect";
import { BadRequest, NotFound } from "~/server/effect/errors";
import {
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

export const DELETE = handler(
  "team.invitations.cancel",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can cancel invitations",
    );

    const { params } = yield* RequestContext;
    const invitationId = params.id;

    const db = yield* Db;
    const invitation = yield* db.use((p) =>
      p.invitation.findUnique({
        where: { id: invitationId },
        select: { businessId: true, status: true },
      }),
    );
    if (!invitation || invitation.businessId !== ctx.businessId) {
      return yield* new NotFound({ message: "Invitation not found" });
    }
    if (invitation.status !== "pending") {
      return yield* new BadRequest({ message: "Invitation is not pending" });
    }

    yield* db.use((p) =>
      p.invitation.update({
        where: { id: invitationId },
        data: { status: "cancelled" },
      }),
    );
    return { success: true };
  }),
);
