import { Effect } from "effect";
import type { BusinessContext } from "~/lib/business-context";
import { isValidRole } from "~/lib/roles";
import { BadRequest, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

/** A member of the caller's business who is not its owner. */
const requireEditableMember = Effect.fn("requireEditableMember")(function* (
  memberId: string,
  ctx: BusinessContext,
) {
  const db = yield* Db;
  const member = yield* db.use((p) =>
    p.user.findUnique({
      where: { id: memberId },
      select: { businessId: true, business: { select: { id: true } } },
    }),
  );
  if (!member || member.businessId !== ctx.businessId) {
    return yield* new NotFound({ message: "Member not found" });
  }
  if (member.business?.id === ctx.businessId) {
    return yield* new BadRequest({
      message: "The business owner cannot be modified",
    });
  }
});

export const PATCH = handler(
  "team.members.update-role",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can update member roles",
    );

    const { params } = yield* RequestContext;
    const memberId = params.id;
    yield* requireEditableMember(memberId, ctx);

    const invalidBody = new BadRequest({ message: "Invalid request body" });
    return yield* Effect.gen(function* () {
      const { role } = yield* readJsonObject(() => invalidBody);
      if (typeof role !== "string" || !isValidRole(role)) {
        return yield* new BadRequest({ message: "Invalid role" });
      }

      const db = yield* Db;
      return yield* db.use((p) =>
        p.user.update({
          where: { id: memberId },
          data: { role },
          select: { id: true, name: true, email: true, role: true },
        }),
      );
    }).pipe(recoverUnexpected(invalidBody));
  }),
);

export const DELETE = handler(
  "team.members.remove",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can remove members",
    );

    const { params } = yield* RequestContext;
    const memberId = params.id;
    if (memberId === session.user.id) {
      return yield* new BadRequest({ message: "Cannot remove yourself" });
    }
    yield* requireEditableMember(memberId, ctx);

    // Clearing `businessId` alone would strand them in an empty app:
    // middleware only routes to /onboarding on `onboardingCompleted ===
    // false`, and that is where they can now create a business of their own.
    const db = yield* Db;
    yield* db.use((p) =>
      p.user.update({
        where: { id: memberId },
        data: { businessId: null, role: "member", onboardingCompleted: false },
      }),
    );
    return { success: true };
  }),
);
