import type { APIEvent } from "@solidjs/start/server";
import { getCompanyProfile } from "~/lib/company-profile";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const identifier = url.searchParams.get("username")?.trim();

  if (!identifier) {
    return Response.json(
      { error: "username query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const partner = await getCompanyProfile(identifier);

    if (!partner) {
      return Response.json({ partner: null }, { status: 404 });
    }

    return Response.json({ partner });
  } catch (err) {
    console.error("[marketplace/partner] query failed:", err);
    return Response.json(
      { error: "Failed to load partner" },
      { status: 500 },
    );
  }
}
