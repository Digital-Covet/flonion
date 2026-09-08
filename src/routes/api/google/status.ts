import type { APIEvent } from "@solidjs/start/server";
import { isGoogleConnected } from "~/lib/google-tokens";
import { getSessionFromHeaders } from "~/lib/server-auth";

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

  return Response.json({ connected: await isGoogleConnected(session.user.id) });
}
