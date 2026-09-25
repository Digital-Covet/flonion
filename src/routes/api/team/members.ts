import { Effect } from "effect";
import { NotFound } from "~/server/effect/errors";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

export const GET = handler(
  "team.members.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;

    const user = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: { businessId: true },
      }),
    );
    const businessId = user?.businessId;
    if (!businessId) {
      return yield* new NotFound({ message: "No business found" });
    }

    const members = yield* db.use((p) =>
      p.user.findMany({
        where: { businessId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          // Ownership is a different link from membership (see
          // business-context): `Business.userId` owns, `User.businessId`
          // belongs. Without it the team page can't tell which row is the
          // owner, and would offer a role select and a Remove button that
          // /api/team/members/[id] answers 400 to.
          business: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    );

    return members.map(({ business, ...member }) => ({
      ...member,
      isOwner: business?.id === businessId,
    }));
  }),
);
