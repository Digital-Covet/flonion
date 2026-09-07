import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getBusinessContext } from "~/lib/business-context";
import { checkRateLimit } from "~/lib/rate-limit";
import { getSessionFromHeaders } from "~/lib/server-auth";

const LOOKUP_RATE_LIMIT = 60;
const LOOKUP_WINDOW_MS = 15 * 60 * 1000;

const MAX_HANDLE_LENGTH = 80;

/** The `username` grammar enforced by POST /api/business. */
const USERNAME_REGEX = /^[a-z0-9-]{1,15}$/;

/**
 * Resolves a business a prospective member wants to join.
 *
 * Exact lookup only -- no prefix or substring matching. The marketplace already
 * exposes business names to any signed-in caller, so a broader search here would
 * leak nothing new, but it would hand joiners a browsable directory to spam, and
 * every join request fans email out to the owner and their admins. Requiring the
 * exact handle means the team told the joiner what it is, which is the
 * out-of-band handshake an approval queue assumes anyway.
 */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only people without a business have any use for this.
  const ctx = await getBusinessContext(session.user.id);
  if (ctx) {
    return Response.json(
      { error: "You already belong to a team" },
      { status: 409 },
    );
  }

  const lookupLimit = checkRateLimit(
    `find-business:${session.user.id}`,
    LOOKUP_RATE_LIMIT,
    LOOKUP_WINDOW_MS,
  );

  if (!lookupLimit.allowed) {
    return Response.json(
      { error: "Too many lookups. Please try again later." },
      { status: 429 },
    );
  }

  const url = new URL(event.request.url);
  const raw = url.searchParams.get("handle") ?? "";
  const handle = raw.trim().replace(/^@/, "").trim().toLowerCase();

  if (!handle || handle.length > MAX_HANDLE_LENGTH) {
    return Response.json(
      { error: "Enter a team handle or the exact business name" },
      { status: 400 },
    );
  }

  const select = {
    id: true,
    name: true,
    username: true,
    logo: true,
    sector: true,
    address: true,
  };

  let business = USERNAME_REGEX.test(handle)
    ? await prisma.business.findUnique({ where: { username: handle }, select })
    : null;

  if (!business) {
    // Falls back to the full business name so a team that never claimed a
    // handle is still reachable. Whole-string equality, never a prefix.
    const matches = await prisma.business.findMany({
      where: { name: { equals: handle, mode: "insensitive" } },
      select,
      take: 2,
    });

    if (matches.length > 1) {
      return Response.json({ business: null, ambiguous: true });
    }

    business = matches[0] ?? null;
  }

  return Response.json({ business });
}
