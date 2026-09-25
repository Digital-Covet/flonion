import { Effect } from "effect";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Google } from "~/server/effect/services/google";

/**
 * Whether this user has a live Google connection.
 *
 * The UI used to infer this from a successful Business Profile API call, which
 * conflated two unrelated things: "is the account linked" and "is the Business
 * Profile API answering right now". A project without Business Profile API
 * quota gets a permanent 429, so a correctly connected owner was shown the
 * "Connect Google" prompt on every visit. Connection state is a property of
 * the stored grant alone, so it is answered here from the grant alone.
 */
export const GET = handler(
  "google.status",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const google = yield* Google;
    // Several widgets ask this per page load; the cache collapses them into
    // one read and is cleared outright whenever the grant changes.
    const connected = yield* google.isConnectedCached(session.user.id);
    return { connected };
  }),
);
