import type { APIEvent } from "@solidjs/start/server";
import { getPartners, parsePartnersQuery } from "~/lib/partners-query";

export type { Partner } from "~/lib/partners-query";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const query = parsePartnersQuery(url);

  try {
    const { payload, cached } = await getPartners(query);

    return Response.json(payload, {
      headers: {
        // `private`, not `public`: this path is not in the middleware's
        // PUBLIC_PREFIXES, so an anonymous caller gets a 401. Marking the 200
        // `public` invites a shared cache to store it and hand it to exactly
        // that caller. The route's own header wins over the middleware's
        // `no-store` guard, so it has to be right here.
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        "X-Cache": cached ? "HIT" : "MISS",
      },
    });
  } catch (err) {
    console.error("[marketplace/partners] query failed:", err);
    return Response.json({ error: "Failed to load partners" }, { status: 500 });
  }
}
