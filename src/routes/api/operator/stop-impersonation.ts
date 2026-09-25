import { Config, Effect, Option } from "effect";
import { currentSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location } });

const deskUrl = Config.String("DESK_APP_URL").pipe(
  Effect.orElseSucceed(() => "http://localhost:5174"),
);

/**
 * Stop impersonation — destroys the impersonated session and redirects
 * the operator back to the desk.
 *
 * When Session.impersonatedBy is set, we know this is an impersonated
 * session. Deleting it and redirecting to the desk effectively "returns"
 * the operator to their own console.
 */
export const GET = handler(
  "operator.stop-impersonation",
  Effect.gen(function* () {
    const session = yield* currentSession;
    if (Option.isNone(session)) return redirect("/login");
    const sessionId = session.value.session.id;

    const db = yield* Db;
    const row = yield* db.use((p) =>
      p.session.findUnique({
        where: { id: sessionId },
        select: { impersonatedBy: true },
      }),
    );

    // Not impersonated — just back to the dashboard.
    if (!row?.impersonatedBy) return redirect("/dashboard");

    yield* db.use((p) => p.session.delete({ where: { id: sessionId } }));
    return redirect(yield* deskUrl);
  }),
);
