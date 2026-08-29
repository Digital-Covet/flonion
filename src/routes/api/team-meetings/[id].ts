import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = event.params.id;

  const meeting = await prisma.teamMeeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId || meeting.businessId !== user.businessId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(meeting);
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = event.params.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const existing = await prisma.teamMeeting.findUnique({
    where: { id: meetingId },
    select: { businessId: true },
  });

  if (!existing || existing.businessId !== user.businessId) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  try {
    const body = await event.request.json();
    const { title, date, startTime, endTime, location } = body;

    const data: Record<string, unknown> = {};

    if (typeof title === "string" && title.trim()) {
      data.title = title.trim();
    }
    if (typeof date === "string" && date) {
      data.date = new Date(date);
    }
    if (typeof startTime === "string" && startTime) {
      data.startTime = startTime;
    }
    if (typeof endTime === "string" && endTime) {
      data.endTime = endTime;
    }
    if (typeof location === "string" && location.trim()) {
      data.location = location.trim();
    }

    const meeting = await prisma.teamMeeting.update({
      where: { id: meetingId },
      data,
    });

    return Response.json(meeting);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = event.params.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const existing = await prisma.teamMeeting.findUnique({
    where: { id: meetingId },
    select: { businessId: true },
  });

  if (!existing || existing.businessId !== user.businessId) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  await prisma.teamMeeting.delete({ where: { id: meetingId } });

  return Response.json({ success: true });
}
