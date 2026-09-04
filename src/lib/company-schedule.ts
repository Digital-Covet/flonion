import { prisma } from "~/db/prisma";

/**
 * Public booking-schedule reads.
 *
 * Lives here rather than inside `/api/company/[username]/schedule` because the
 * SSR pass of `/company/[username]/bookings` needs the same data, and a
 * relative `fetch("/api/...")` has no origin to resolve against on the server.
 * The page guards its import with `import.meta.env.SSR` so Vite folds the
 * branch and Prisma never reaches the browser bundle -- same pattern as
 * `~/lib/company-profile` and `~/lib/partners-query`.
 */

export const MAX_SCHEDULE_RANGE_DAYS = 30;

export interface ScheduleBusinessInfo {
  name: string;
  logo: string | null;
  sector: string | null;
  description: string | null;
  username: string | null;
  workingDays: string;
  workingStartTime: string;
  workingEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
  timezone: string;
}

export interface ScheduleEvent {
  id: string;
  type: "slot";
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
  title?: string | null;
}

export interface CompanySchedule {
  business: ScheduleBusinessInfo;
  events: ScheduleEvent[];
}

/** Looks a business up by its vanity username, falling back to its id. */
export async function getCompanySchedule(
  identifier: string,
  startDate: Date,
  endDate: Date,
): Promise<CompanySchedule | null> {
  const key = identifier.trim();
  if (!key) return null;

  const select = {
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
  } as const;

  const business =
    (await prisma.business.findUnique({ where: { username: key }, select })) ||
    (await prisma.business.findUnique({ where: { id: key }, select }));

  if (!business) return null;

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

  const events: ScheduleEvent[] = slots.map((slot) => {
    const isBooked =
      slot.isBooked ||
      slotIdsWithMeeting.has(slot.id) ||
      slot.meetingRequest?.status === "accepted";
    return {
      id: slot.id,
      type: "slot",
      date: slot.date.toISOString(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: isBooked ? "booked" : "available",
      title: slot.title ?? (isBooked ? "Booked" : undefined),
    };
  });

  for (const tm of teamMeetings) {
    events.push({
      id: `team-${tm.id}`,
      type: "slot",
      date: tm.date.toISOString(),
      startTime: tm.startTime,
      endTime: tm.endTime,
      status: "booked",
      title: tm.title || "Team Meeting",
    });
  }

  events.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.startTime.localeCompare(b.startTime);
  });

  const { id: _id, ...publicBusiness } = business;

  return { business: publicBusiness, events };
}
