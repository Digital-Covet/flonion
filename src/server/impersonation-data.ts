import { Effect, Option } from "effect";
import { RequestContext } from "~/server/effect/request-context";
import { runServerFn } from "~/server/effect/server-fn";
import { Auth } from "~/server/effect/services/auth";
import { Db } from "~/server/effect/services/db";

/**
 * Server-only body of `getImpersonation`. Looks the session up from the
 * headers rather than middleware's stash, as it always has: the banner must
 * show even where middleware treats the account as signed out.
 */
export function loadImpersonation(): Promise<{ name: string } | null> {
  return runServerFn(
    Effect.gen(function* () {
      const { request } = yield* RequestContext;
      const auth = yield* Auth;
      const session = yield* auth.getSession(request.headers);
      if (Option.isNone(session)) return null;

      const db = yield* Db;
      const row = yield* db.use((p) =>
        p.session.findUnique({
          where: { id: session.value.session.id },
          select: { impersonatedBy: true },
        }),
      );
      if (!row?.impersonatedBy) return null;

      const { user } = session.value;
      return { name: user.name || user.email };
    }),
  );
}
