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
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Cache": cached ? "HIT" : "MISS",
      },
    });
  } catch (err) {
    console.error("[marketplace/partners] query failed:", err);
    return Response.json({ error: "Failed to load partners" }, { status: 500 });
  }
}
