import { Effect } from "effect";
import {
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

export const GET = handler(
  "team.invitations.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    // Pending invitee addresses are management data, and this listing is only
    // consumed by the admin-gated section of the team settings page.
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can view invitations",
    );

    // Declined invites are listed alongside pending ones so the inviter sees
    // the outcome instead of watching an invitation that will never resolve.
    const db = yield* Db;
    return yield* db.use((p) =>
      p.invitation.findMany({
        where: {
          businessId: ctx.businessId,
          status: { in: ["pending", "declined"] },
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);
