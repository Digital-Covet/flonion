import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { loadCampaignAnalytics } from "~/server/analytics-data";

/**
 * Kept for any client that still fetches this directly; the analytics page
 * reads the same data through `getCampaignAnalytics()`. Both share
 * `loadCampaignAnalytics` so the two responses cannot drift.
 */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await loadCampaignAnalytics(session.session.userId));
}
