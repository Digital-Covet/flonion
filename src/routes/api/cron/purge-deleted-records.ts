import { createHash, timingSafeEqual } from "node:crypto";
import { Effect, Option, Redacted } from "effect";
import { optionalSecret } from "~/server/effect/config";
import { RawResponse } from "~/server/effect/errors";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

/**
 * Vercel Cron (see vercel.json): drops archived deletes past their year.
 *
 * Vercel sends `CRON_SECRET` as a Bearer token. Without the env var set the
 * route refuses everything rather than running unauthenticated.
 */
export const GET = handler(
  "cron.purge-deleted-records",
  Effect.gen(function* () {
    const { request } = yield* RequestContext;
    const secret = yield* optionalSecret("CRON_SECRET");
    const auth = request.headers.get("authorization") ?? "";
    if (
      Option.isNone(secret) ||
      !matches(auth, `Bearer ${Redacted.value(secret.value)}`)
    ) {
      return yield* new RawResponse({
        response: json({ error: "Unauthorized" }, 401),
      });
    }

    const db = yield* Db;
    const [{ purged }] = yield* db.use(
      (p) => p.$queryRaw<{ purged: number }[]>`
        SELECT purge_deleted_records() AS purged
      `,
    );
    return json({ purged }, 200);
  }),
);

/** Constant-time; hashing first makes the lengths equal. */
function matches(actual: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
