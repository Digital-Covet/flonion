import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";

const MAX_RANGE_DAYS = 30;

export async function GET(event: APIEvent) {
  const username = event.params.username;

  if (!username) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  const url = new URL(event.request.url);

  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setHours(0, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 7);

  const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
  const endDate = endDateParam ? new Date(endDateParam) : defaultEnd;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_RANGE_DAYS) {
    return Response.json(
      { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
      { status: 400 },
    );
  }

  try {
    const business = await prisma.business.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        logo: true,
        sector: true,
        description: true,
        username: true,
        workingDays: true,
        workingStartTime: true,
        workingEndTime: true,
        bookingStartTime: true,
        bookingEndTime: true,
        slotDuration: true,
        timezone: true,
      },
    });

    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    const [slots, meetings, teamMeetings] = await Promise.all([
      prisma.availabilitySlot.findMany({
        where: {
          businessId: business.id,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          isBooked: true,
          title: true,
          meetingRequest: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.meetingRequest.findMany({
        where: {
          businessId: business.id,
          status: "accepted",
          slot: {
            date: { gte: startDate, lte: endDate },
          },
        },
        select: {
          id: true,
          slotId: true,
          slot: {
            select: {
              date: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
      prisma.teamMeeting.findMany({
        where: {
          businessId: business.id,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    const slotIdsWithMeeting = new Set(meetings.map((m) => m.slotId));

    const events = slots.map((slot) => {
      const isBooked = slot.isBooked || slotIdsWithMeeting.has(slot.id) || slot.meetingRequest?.status === "accepted";
      return {
        id: slot.id,
        type: "slot" as const,
        date: slot.date.toISOString(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: isBooked ? ("booked" as const) : ("available" as const),
        title: slot.title ?? (isBooked ? "Booked" : undefined),
      };
    });

    for (const tm of teamMeetings) {
      events.push({
        id: `team-${tm.id}`,
        type: "slot" as const,
        date: tm.date.toISOString(),
        startTime: tm.startTime,
        endTime: tm.endTime,
        status: "booked" as const,
        title: tm.title || "Team Meeting",
      });
    }

    events.sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return a.startTime.localeCompare(b.startTime);
    });

    return Response.json({
      business: {
        name: business.name,
        logo: business.logo,
        sector: business.sector,
        description: business.description,
        username: business.username,
        workingDays: business.workingDays,
        workingStartTime: business.workingStartTime,
        workingEndTime: business.workingEndTime,
        bookingStartTime: business.bookingStartTime,
        bookingEndTime: business.bookingEndTime,
        slotDuration: business.slotDuration,
        timezone: business.timezone,
      },
      events,
    });
  } catch (err) {
    console.error("[company/schedule] query failed:", err);
    return Response.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}
