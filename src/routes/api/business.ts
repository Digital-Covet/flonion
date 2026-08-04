import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
  });

  return Response.json({
    placeId: business?.placeId ?? "",
    logo: business?.logo ?? null,
    businessName: business?.name ?? "",
    phone: business?.phone ?? "",
    address: business?.address ?? "",
  });
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { placeId, logo, businessName, phone, address } = body;

    if (typeof businessName !== "string" || !businessName.trim()) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 },
      );
    }

    const data = {
      placeId: typeof placeId === "string" ? placeId : null,
      logo: typeof logo === "string" ? logo : null,
      name: businessName.trim(),
      phone: typeof phone === "string" ? phone : null,
      address: typeof address === "string" ? address : null,
    };

    const business = await prisma.business.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    });

    return Response.json({
      placeId: business.placeId ?? "",
      logo: business.logo ?? null,
      businessName: business.name,
      phone: business.phone ?? "",
      address: business.address ?? "",
    });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
