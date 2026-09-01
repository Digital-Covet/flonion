import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    const now = new Date();

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: {
        businessId: business.id,
        date: { gte: now },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isBooked: true,
      },
    });

    return Response.json({ slots: availabilitySlots });
  } catch (err) {
    console.error("[marketplace/slots/mine] query failed:", err);
    return Response.json({ error: "Failed to load slots" }, { status: 500 });
  }
}
