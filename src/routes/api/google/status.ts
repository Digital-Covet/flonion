import type { APIEvent } from "@solidjs/start/server";
import { isGoogleConnected } from "~/lib/google-tokens";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { connectedCache } from "~/server/google-cache";

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
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Several widgets ask this per page load; the cache collapses them into one
  // read and is cleared outright whenever the grant changes.
  const connected = await connectedCache.get(session.user.id, () =>
    isGoogleConnected(session.user.id),
  );

  return Response.json({ connected });
}
