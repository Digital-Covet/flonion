import { Effect } from "effect";
import { describeUserAgent } from "~/lib/user-agent";
import { Forbidden } from "~/server/effect/errors";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

/*
 * The caller's own sign-ins, for the Devices section of /account. Not
 * better-auth's /list-sessions: that one refuses sessions older than its
 * `freshAge` (a day) and hands every session token to the browser, where this
 * returns ids only.
 */

const IMPERSONATION_MESSAGE =
  "Devices can't be logged out while you're viewing as this user";

export const GET = handler(
  "account.sessions.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const currentId = session.session.id;

    const db = yield* Db;
    const rows = yield* db.use((p) =>
      p.session.findMany({
        // Operator impersonation sessions stay hidden, as better-auth's admin
        // plugin hides them from /list-sessions.
        where: {
          userId: session.user.id,
          expiresAt: { gt: new Date() },
          impersonatedBy: null,
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          ipAddress: true,
          userAgent: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    );

    const sessions = rows.map((row) => ({
      id: row.id,
      current: row.id === currentId,
      ...describeUserAgent(row.userAgent),
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.updatedAt.toISOString(),
    }));
    // This device first, then most recently active.
    sessions.sort((a, b) => Number(b.current) - Number(a.current));
    return { sessions };
  }),
);

/** Log out every other device; this one stays signed in. */
export const DELETE = handler(
  "account.sessions.revoke-others",
  Effect.gen(function* () {
    const session = yield* requireSession();
    if (session.session.impersonatedBy) {
      return yield* new Forbidden({ message: IMPERSONATION_MESSAGE });
    }

    const db = yield* Db;
    const { count } = yield* db.use((p) =>
      p.session.deleteMany({
        where: { userId: session.user.id, id: { not: session.session.id } },
      }),
    );
    return { revoked: count };
  }),
);
