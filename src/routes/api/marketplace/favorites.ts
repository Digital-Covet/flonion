import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const favorites = await prisma.favoritePartner.findMany({
      where: { userId: session.user.id },
      select: { businessId: true },
    });

    return Response.json({ favorites: favorites.map((f) => f.businessId) });
  } catch (err) {
    console.error("[marketplace/favorites] GET failed:", err);
    return Response.json({ error: "Failed to load favorites" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { businessId } = body;

    if (typeof businessId !== "string" || !businessId) {
      return Response.json({ error: "businessId is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    const existing = await prisma.favoritePartner.findUnique({
      where: {
        userId_businessId: { userId: session.user.id, businessId },
      },
    });

    if (existing) {
      await prisma.favoritePartner.delete({ where: { id: existing.id } });
      return Response.json({ favorited: false });
    }

    await prisma.favoritePartner.create({
      data: { userId: session.user.id, businessId },
    });
    return Response.json({ favorited: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[marketplace/favorites] POST failed:", err);
    return Response.json({ error: "Failed to update favorite" }, { status: 500 });
  }
}
