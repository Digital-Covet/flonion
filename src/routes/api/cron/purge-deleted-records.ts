import { createHash, timingSafeEqual } from "node:crypto";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";

/**
 * Vercel Cron (see vercel.json): drops archived deletes past their year.
 *
 * Vercel sends `CRON_SECRET` as a Bearer token. Without the env var set the
 * route refuses everything rather than running unauthenticated.
 */
export async function GET(event: APIEvent) {
  const secret = process.env.CRON_SECRET;
  const auth = event.request.headers.get("authorization") ?? "";
  if (!secret || !matches(auth, `Bearer ${secret}`)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const [{ purged }] = await prisma.$queryRaw<{ purged: number }[]>`
    SELECT purge_deleted_records() AS purged
  `;
  return json({ purged }, 200);
}

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
