import { Effect } from "effect";
import {
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

/** How long a resolved request stays visible in the queue. */
const RESOLVED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_ROWS = 100;

export const GET = handler(
  "team.join-requests.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    // Unlike the older team listings, this one is gated: it exposes the email
    // addresses of people who are not (yet) members.
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can view join requests",
    );

    // Resolved rows are listed alongside pending ones for the same reason
    // /api/team/invitations returns declined invites -- an admin should see
    // the outcome rather than watch a row disappear.
    const db = yield* Db;
    return yield* db.use((p) =>
      p.joinRequest.findMany({
        where: {
          businessId: ctx.businessId,
          OR: [
            { status: "pending" },
            { reviewedAt: { gt: new Date(Date.now() - RESOLVED_WINDOW_MS) } },
          ],
        },
        select: {
          id: true,
          message: true,
          status: true,
          grantedRole: true,
          createdAt: true,
          reviewedAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          reviewedBy: { select: { name: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: MAX_ROWS,
      }),
    );
  }),
);
