import { api } from "~/components/onboarding/ui";

/**
 * Meeting scheduler state and fetching (spec §6,
 * `/collaborations/meeting-schedular`: week calendar, incoming/outgoing tabs,
 * load).
 *
 * Types and plain functions only — the page imports this module, so nothing
 * here may reach for Prisma or anything else that belongs on the server.
 */

// ─── Shapes ──────────────────────────────────────────────────────────────

export type MeetingStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type MeetingDirection = "incoming" | "outgoing";
export type MeetingCategory = "team" | "partner";

/** One row of `GET /api/marketplace/meetings`. */
export type Meeting = {
  id: string;
  status: MeetingStatus;
  /** Server-computed: incoming means the owner's business is the host. */
  direction: MeetingDirection;
  /** Server-computed: team when the requester belongs to the same business. */
  category: MeetingCategory;
  message: string | null;
  guestName: string | null;
  guestEmail: string | null;
  meetUri: string | null;
  createdAt: string;
  slot: { date: string; startTime: string; endTime: string };
  business: {
    id: string;
    name: string;
    logo: string | null;
    username: string | null;
  } | null;
  requester: { id: string; name: string; email: string } | null;
};

/** One row of `GET /api/marketplace/slots/mine` — the owner's own calendar. */
export type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
};

export type LoadBucket = {
  value: number;
  detail: string;
  tone: "orange" | "primary";
};

export type LoadSummary = {
  thisWeek: LoadBucket;
  nextWeek: LoadBucket;
  tip: string;
};

export type ScheduleSettings = {
  workingDays: string;
  workingStartTime: string;
  workingEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
  timezone: string;
  username: string | null;
};

// ─── View state ──────────────────────────────────────────────────────────

export const MEETING_TABS = [
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
  { value: "all", label: "All" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type MeetingTab = (typeof MEETING_TABS)[number]["value"];

/** "Declined" folds in cancelled, which owners read as the same outcome. */
export const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "pending", label: "Awaiting reply" },
  { value: "accepted", label: "Confirmed" },
  { value: "declined", label: "Declined" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

export const CATEGORY_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "partner", label: "Partners" },
  { value: "team", label: "Team" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type CategoryFilter = (typeof CATEGORY_OPTIONS)[number]["value"];

export type MeetingsView = {
  tab: MeetingTab;
  status: StatusFilter;
  category: CategoryFilter;
  /** Monday of the week the calendar shows, as `YYYY-MM-DD`. */
  week: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * The whole view lives in the URL, so a week the owner is looking at survives
 * a reload and can be handed to a colleague.
 */
export function viewFrom(params: SearchParams): MeetingsView {
  const week = one(params.week);
  return {
    tab: pick(
      one(params.tab),
      MEETING_TABS.map((t) => t.value),
      "incoming",
    ),
    status: pick(
      one(params.status),
      STATUS_OPTIONS.map((o) => o.value),
      "all",
    ),
    category: pick(
      one(params.category),
      CATEGORY_OPTIONS.map((o) => o.value),
      "all",
    ),
    week: isDayKey(week) ? dayKey(startOfWeek(parseDayKey(week))) : "",
  };
}

/** Defaults drop out so a plain link stays clean. */
export function viewParams(view: MeetingsView, now = new Date()) {
  return {
    tab: view.tab === "incoming" ? undefined : view.tab,
    status: view.status === "all" ? undefined : view.status,
    category: view.category === "all" ? undefined : view.category,
    week:
      view.week && view.week !== dayKey(startOfWeek(now))
        ? view.week
        : undefined,
  };
}

/** The week the calendar shows: the one in the URL, else the current one. */
export function weekStart(view: MeetingsView, now = new Date()): Date {
  return view.week ? parseDayKey(view.week) : startOfWeek(now);
}

// ─── Dates ───────────────────────────────────────────────────────────────

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string | undefined): value is string {
  if (!value || !DAY_KEY_RE.test(value)) return false;
  return !Number.isNaN(parseDayKey(value).getTime());
}

/** Local midnight for a `YYYY-MM-DD` key; never UTC, so no day ever shifts. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Weeks run Monday to Sunday, matching `GET /api/marketplace/load`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  return addDays(start, day === 0 ? -6 : 1 - day);
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** "14 – 20 Sep 2026", collapsed the way the reader's locale collapses it. */
export function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const format = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // formatRange drops the parts both ends share ("Sep 14 – 20, 2026"); older
  // engines without it get the two dates spelled out.
  return typeof format.formatRange === "function"
    ? format.formatRange(start, end)
    : `${format.format(start)} – ${format.format(end)}`;
}

/**
 * Slot dates are stored as midnight UTC and the times are local wall clock,
 * so the day comes from the ISO string rather than from a parsed Date.
 */
export const slotDayKey = (isoDate: string): string => isoDate.slice(0, 10);

export function meetingStart(meeting: Meeting): Date {
  return new Date(`${slotDayKey(meeting.slot.date)}T${meeting.slot.startTime}`);
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "Mon 15 Sep · 14:00–14:30" for a request card. */
export function meetingWhen(meeting: Meeting): string {
  const date = meetingStart(meeting).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date} · ${meeting.slot.startTime}–${meeting.slot.endTime}`;
}

// ─── Reading a meeting ───────────────────────────────────────────────────

/** Who the meeting is with, from this owner's side of it. */
export function counterparty(meeting: Meeting): string {
  if (meeting.direction === "outgoing") {
    return meeting.business?.name ?? "Partner";
  }
  return meeting.requester?.name || meeting.guestName || "Guest";
}

export function counterpartyEmail(meeting: Meeting): string | null {
  if (meeting.direction === "outgoing") return null;
  return meeting.requester?.email || meeting.guestEmail || null;
}

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  pending: "Awaiting reply",
  accepted: "Confirmed",
  rejected: "Declined",
  cancelled: "Cancelled",
};

/** Only a pending request the owner is hosting can be accepted or rejected. */
export function canDecide(meeting: Meeting): boolean {
  return meeting.direction === "incoming" && meeting.status === "pending";
}

export function isUpcoming(meeting: Meeting, now = new Date()): boolean {
  return meetingStart(meeting).getTime() >= now.getTime();
}

export function matchesView(meeting: Meeting, view: MeetingsView): boolean {
  if (view.tab !== "all" && meeting.direction !== view.tab) return false;
  if (view.category !== "all" && meeting.category !== view.category)
    return false;
  if (view.status === "all") return true;
  if (view.status === "declined") {
    return meeting.status === "rejected" || meeting.status === "cancelled";
  }
  return meeting.status === view.status;
}

/**
 * Requests needing the owner's reply first, then everything else newest-first,
 * because the page's job is triage.
 */
export function sortForTriage(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => {
    const decide = Number(canDecide(b)) - Number(canDecide(a));
    if (decide !== 0) return decide;
    return meetingStart(b).getTime() - meetingStart(a).getTime();
  });
}

/** Count of incoming requests still waiting on the owner. */
export function needsReplyCount(meetings: Meeting[]): number {
  return meetings.filter(canDecide).length;
}

export function meetingsOnDay(meetings: Meeting[], key: string): Meeting[] {
  return meetings
    .filter(
      (m) =>
        slotDayKey(m.slot.date) === key &&
        m.status !== "rejected" &&
        m.status !== "cancelled",
    )
    .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
}

export function slotsOnDay(slots: Slot[], key: string): Slot[] {
  return slots
    .filter((s) => slotDayKey(s.date) === key)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ─── Fetching ────────────────────────────────────────────────────────────

export async function loadMeetings(): Promise<Meeting[]> {
  const res = await api<{ meetings: Meeting[] }>("/api/marketplace/meetings");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load meetings");
  return res.data.meetings ?? [];
}

/**
 * The owner's own slots, booked and free. Members without a business get a
 * 400 from the API — that's "no calendar yet", not a failure to load one.
 */
export async function loadMySlots(): Promise<Slot[]> {
  const res = await api<{ slots: Slot[] }>("/api/marketplace/slots/mine");
  if (res.status === 400) return [];
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load slots");
  return res.data.slots ?? [];
}

export async function loadLoadSummary(): Promise<LoadSummary> {
  const res = await api<LoadSummary>("/api/marketplace/load");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load schedule");
  return res.data as LoadSummary;
}

export async function loadScheduleSettings(): Promise<ScheduleSettings | null> {
  const res = await api<{ settings: ScheduleSettings }>(
    "/api/marketplace/schedule-settings",
  );
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load settings");
  return res.data.settings ?? null;
}

/** Accept or reject an incoming request; the server frees the slot on reject. */
export async function decideMeeting(
  id: string,
  action: "accept" | "reject",
): Promise<void> {
  const res = await api(`/api/marketplace/meetings/${id}`, {
    method: "PATCH",
    body: { action },
  });
  if (!res.ok) {
    throw new Error(
      res.data.error ??
        (action === "accept"
          ? "Failed to accept the request"
          : "Failed to decline the request"),
    );
  }
}

export const MAX_GENERATE_DAYS = 90;

/**
 * Rebuilds bookable slots across a date range from the business's booking
 * hours. Booked slots are always kept.
 *
 * `days` (0 = Sunday) opens exactly those weekdays and only rebuilds them, so
 * a one-off Saturday needs no change to the saved working days and the free
 * slots already open on the other days survive. Omitting it falls back to the
 * business's working days and rebuilds the whole range.
 */
export async function generateSlots(
  startDate: string,
  endDate: string,
  days?: number[],
): Promise<number> {
  const res = await api<{ created: number }>(
    "/api/marketplace/slots/generate",
    { method: "POST", body: { startDate, endDate, days } },
  );
  if (!res.ok) throw new Error(res.data.error ?? "Failed to open slots");
  return res.data.created ?? 0;
}

// ─── Formatting ──────────────────────────────────────────────────────────

export function slotCountLabel(count: number): string {
  return count === 1 ? "slot" : "slots";
}

export function requestCountLabel(count: number): string {
  return count === 1 ? "request" : "requests";
}

// ─── Weekdays ────────────────────────────────────────────────────────────

/** Monday first, matching the week the calendar and the load API run on. */
export const WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" },
] as const satisfies ReadonlyArray<{
  value: number;
  short: string;
  label: string;
}>;

/** Working days are stored as "1,2,3,4,5" (0 = Sunday). */
export function parseWorkingDays(workingDays: string): number[] {
  const days = workingDays
    .split(",")
    .map((d) => Number.parseInt(d, 10))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return sortDays([...new Set(days)]);
}

/** Sunday sorts last, so a selection reads the way the week is shown. */
export function sortDays(days: number[]): number[] {
  return [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
}

export function dayShortLabels(days: number[]): string[] {
  return sortDays(days).map(
    (d) => WEEKDAYS.find((w) => w.value === d)?.short ?? "",
  );
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

/** How many slots one open day yields, from the saved booking window. */
export function slotsPerDay(settings: ScheduleSettings): number {
  const span =
    minutesOf(settings.bookingEndTime) - minutesOf(settings.bookingStartTime);
  if (span <= 0 || settings.slotDuration <= 0) return 0;
  return Math.floor(span / settings.slotDuration);
}

/** Dates in an inclusive range whose weekday is in `days`. */
export function matchingDayCount(
  startKey: string,
  endKey: string,
  days: number[],
): number {
  if (!isDayKey(startKey) || !isDayKey(endKey) || days.length === 0) return 0;
  const end = parseDayKey(endKey);
  let count = 0;
  for (let date = parseDayKey(startKey); date <= end; date = addDays(date, 1)) {
    if (days.includes(date.getDay())) count += 1;
  }
  return count;
}
