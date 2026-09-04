import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";

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
    const business =
      (await prisma.business.findUnique({ where: { username: identifier } })) ||
      (await prisma.business.findUnique({ where: { id: identifier } }));

    if (!business) {
      return Response.json({ partner: null }, { status: 404 });
    }

    return Response.json({
      partner: {
        id: business.id,
        name: business.name,
        username: business.username,
        logo: business.logo,
        description: business.description,
        sector: business.sector,
        rating: business.rating,
        reviewCount: business.reviewCount,
        address: business.address,
        phone: business.phone,
      },
    });
  } catch (err) {
    console.error("[marketplace/partner] query failed:", err);
    return Response.json(
      { error: "Failed to load partner" },
      { status: 500 },
    );
  }
}
