import { db } from "./db";
import { parsePageParams, offset, orderBy, pageResult, type PageResult } from "./paging";

// ---------------------------------------------------------------------------
// Meeting Requests
// ---------------------------------------------------------------------------

export interface MeetingRequestRow {
  id: string;
  slotId: string;
  status: string;
  message: string | null;
  meetUri: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  createdAt: string;
  business: { id: string; name: string };
  requester: { id: string; name: string; email: string } | null;
  slot: { date: string; startTime: string; endTime: string };
}

const REQUEST_SORT: Record<string, string> = {
  createdAt: "createdAt",
};

export async function listMeetingRequests(
  searchParams: URLSearchParams,
): Promise<PageResult<MeetingRequestRow>> {
  const params = parsePageParams(searchParams, REQUEST_SORT, "createdAt");

  const where: Record<string, unknown> = {};

  const status = searchParams.get("status");
  if (status) where.status = status;

  const businessId = searchParams.get("businessId");
  if (businessId) where.businessId = businessId;

  const hasMeet = searchParams.get("hasMeet");
  if (hasMeet === "true") where.meetUri = { not: null };
  if (hasMeet === "false") where.meetUri = null;

  const isGuest = searchParams.get("isGuest");
  if (isGuest === "true") where.requesterId = null;
  if (isGuest === "false") where.requesterId = { not: null };

  const upcoming = searchParams.get("upcoming");
  const now = new Date().toISOString();
  if (upcoming === "true") where.slot = { date: { gte: now } };
  if (upcoming === "false") where.slot = { date: { lt: now } };

  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

  const [rows, total] = await Promise.all([
    db.meetingRequest.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        id: true,
        slotId: true,
        status: true,
        message: true,
        meetUri: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
        requester: {
          select: { id: true, name: true, email: true },
        },
        slot: {
          select: { date: true, startTime: true, endTime: true },
        },
      },
    }),
    db.meetingRequest.count({ where }),
  ]);

  return pageResult(rows as MeetingRequestRow[], total, params);
}

// ---------------------------------------------------------------------------
// Team Meetings
// ---------------------------------------------------------------------------

export interface TeamMeetingRow {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetUri: string | null;
  createdAt: string;
  business: { id: string; name: string };
}

const TEAM_SORT: Record<string, string> = {
  date: "date",
  createdAt: "createdAt",
};

export async function listTeamMeetings(
  searchParams: URLSearchParams,
): Promise<PageResult<TeamMeetingRow>> {
  const params = parsePageParams(searchParams, TEAM_SORT, "date");

  const where: Record<string, unknown> = {};

  const businessId = searchParams.get("businessId");
  if (businessId) where.businessId = businessId;

  const [rows, total] = await Promise.all([
    db.teamMeeting.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        id: true,
        title: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        meetUri: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
      },
    }),
    db.teamMeeting.count({ where }),
  ]);

  return pageResult(rows as TeamMeetingRow[], total, params);
}

// ---------------------------------------------------------------------------
// Slot Health
// ---------------------------------------------------------------------------

export interface SlotHealth {
  totalSlots: number;
  bookedSlots: number;
  freeSlots: number;
  businessesWithZeroFutureSlots: number;
  orphanedBookings: number;
}

export async function getSlotHealth(): Promise<SlotHealth> {
  const now = new Date().toISOString();

  const [totalSlots, bookedSlots, businessesWithZero, orphaned] = await Promise.all([
    db.availabilitySlot.count(),
    db.availabilitySlot.count({ where: { isBooked: true } }),
    // Businesses with zero future slots
    db.business.count({
      where: {
        availabilitySlots: { none: { date: { gte: now } } },
      },
    }),
    // Orphaned bookings: slot marked booked but no meeting request
    db.availabilitySlot.count({
      where: {
        isBooked: true,
        meetingRequest: null,
      },
    }),
  ]);

  return {
    totalSlots,
    bookedSlots,
    freeSlots: totalSlots - bookedSlots,
    businessesWithZeroFutureSlots: businessesWithZero,
    orphanedBookings: orphaned,
  };
}
