import { Effect } from "effect";
import {
  businessContextSelect,
  toBusinessContext,
} from "~/lib/business-context";
import { BadRequest, Conflict } from "~/server/effect/errors";
import { rateLimit, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const LOOKUP_RATE_LIMIT = 60;
const LOOKUP_WINDOW_MS = 15 * 60 * 1000;

const MAX_HANDLE_LENGTH = 80;

/** The `username` grammar enforced by POST /api/business. */
const USERNAME_REGEX = /^[a-z0-9-]{1,15}$/;

const select = {
  id: true,
  name: true,
  username: true,
  logo: true,
  sector: true,
  address: true,
} as const;

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
export const GET = handler(
  "team.find-business",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;

    // Only people without a business have any use for this.
    const self = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: businessContextSelect,
      }),
    );
    if (toBusinessContext(session.user.id, self)) {
      return yield* new Conflict({ message: "You already belong to a team" });
    }

    yield* rateLimit(
      `find-business:${session.user.id}`,
      LOOKUP_RATE_LIMIT,
      LOOKUP_WINDOW_MS,
      { message: "Too many lookups. Please try again later." },
    );

    const { url } = yield* RequestContext;
    const raw = url.searchParams.get("handle") ?? "";
    const handle = raw.trim().replace(/^@/, "").trim().toLowerCase();

    if (!handle || handle.length > MAX_HANDLE_LENGTH) {
      return yield* new BadRequest({
        message: "Enter a team handle or the exact business name",
      });
    }

    const byUsername = USERNAME_REGEX.test(handle)
      ? yield* db.use((p) =>
          p.business.findUnique({
            where: { username: handle, status: "active" },
            select,
          }),
        )
      : null;
    if (byUsername) return { business: byUsername };

    // Falls back to the full business name so a team that never claimed a
    // handle is still reachable. Whole-string equality, never a prefix.
    const matches = yield* db.use((p) =>
      p.business.findMany({
        where: {
          name: { equals: handle, mode: "insensitive" },
          status: "active",
        },
        select,
        take: 2,
      }),
    );
    if (matches.length > 1) return { business: null, ambiguous: true };
    return { business: matches[0] ?? null };
  }),
);
