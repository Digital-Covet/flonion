import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const url = new URL(event.request.url);
  const dateParam = url.searchParams.get("date");

  const where: Record<string, unknown> = { businessId: user.businessId };

  if (dateParam) {
    const date = new Date(dateParam);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    where.date = { gte: startOfDay, lte: endOfDay };
  }

  const meetings = await prisma.teamMeeting.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return Response.json(meetings);
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  try {
    const body = await event.request.json();
    const { title, date, startTime, endTime, location } = body;

    if (typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    if (typeof date !== "string" || !date) {
      return Response.json({ error: "Date is required" }, { status: 400 });
    }

    if (typeof startTime !== "string" || !startTime) {
      return Response.json({ error: "Start time is required" }, { status: 400 });
    }

    if (typeof endTime !== "string" || !endTime) {
      return Response.json({ error: "End time is required" }, { status: 400 });
    }

    if (typeof location !== "string" || !location.trim()) {
      return Response.json({ error: "Location is required" }, { status: 400 });
    }

    const meeting = await prisma.teamMeeting.create({
      data: {
        title: title.trim(),
        date: new Date(date),
        startTime,
        endTime,
        location: location.trim(),
        businessId: user.businessId,
      },
    });

    return Response.json(meeting, { status: 201 });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
