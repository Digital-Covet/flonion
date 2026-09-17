import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Lock,
  MapPin,
  Video,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import InlineCombinationMark from "@/assets/inline-combination-mark";
import { Skeleton, WidgetError } from "~/components/ui/skeleton";
import { AppToaster, notify } from "~/components/ui/toast";
import { generateIcsInvite } from "~/lib/ics";
import { tzLabel } from "~/lib/timezone-label";

interface BusinessInfo {
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

interface ScheduleEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
  title?: string | null;
}

interface ScheduleData {
  business: BusinessInfo;
  events: ScheduleEvent[];
}

// SSR-safe fetch: relative fetch has no origin on the server, so hit the DB
// directly during SSR (Prisma is dead-code eliminated from the browser bundle
// via the SSR literal fold). Same pattern as ~/lib/company-profile.
async function fetchSchedule(username?: string): Promise<ScheduleData | null> {
  if (!username) return null;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  try {
    if (import.meta.env.SSR) {
      const { getCompanySchedule } = await import("~/lib/company-schedule");
      return await getCompanySchedule(username, start, end);
    }

    const res = await fetch(
      `/api/company/${encodeURIComponent(username)}/schedule?startDate=${formatDate(start)}&endDate=${formatDate(end)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error("[fetchSchedule]", res.status, body?.error ?? "unknown");
      throw new Error(body?.error ?? "Could not load the schedule.");
    }
    return await res.json();
  } catch (err) {
    console.error("[fetchSchedule] failed:", err);
    return null;
  }
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eventDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return dateKeyOf(d);
}

function isPastSlot(ev: ScheduleEvent): boolean {
  const day = new Date(ev.date);
  if (Number.isNaN(day.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotDay = new Date(day);
  slotDay.setHours(0, 0, 0, 0);
  if (slotDay.getTime() < today.getTime()) return true;
  if (slotDay.getTime() > today.getTime()) return false;
  // Same day: compare end time wall-clock.
  const m = ev.endTime.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return Number(m[1]) * 60 + Number(m[2]) <= nowMinutes;
}

const INPUT_CLASS =
  "h-14 w-full rounded-control border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function PublicBookingsPage() {
  const params = useParams<{ username: string }>();
  const [data, { refetch }] = createResource(
    () => params.username,
    fetchSchedule,
  );

  // DS §6 flow: date strip -> slot chips -> guest details -> confirm.
  const [activeDate, setActiveDate] = createSignal<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = createSignal<string | null>(null);

  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [meetLink, setMeetLink] = createSignal<string | null>(null);
  const [icsHref, setIcsHref] = createSignal<string | null>(null);

  let guestHeadingRef: HTMLHeadingElement | undefined;

  const todayKey = () => dateKeyOf(new Date());

  // Month calendar cursor (no scrolling — static grid + prev/next).
  const now = new Date();
  const [monthCursor, setMonthCursor] = createSignal({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const days = createMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  const windowKeys = createMemo(() => new Set(days().map(dateKeyOf)));

  const calendarCells = createMemo(() => {
    const { year, month } = monthCursor();
    const first = new Date(year, month, 1);
    // Monday-first offset (Mon=0 … Sun=6).
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells: ({ date: Date; key: string } | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let day = 1; day <= count; day++) {
      const date = new Date(year, month, day);
      cells.push({ date, key: dateKeyOf(date) });
    }
    return cells;
  });

  const monthLabel = createMemo(() => {
    const { year, month } = monthCursor();
    return new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  });

  const canGoPrev = createMemo(() => {
    const { year, month } = monthCursor();
    const t = new Date();
    return year > t.getFullYear() || month > t.getMonth();
  });

  const goMonth = (dir: 1 | -1) => {
    if (dir === -1 && !canGoPrev()) return;
    setMonthCursor((c) => {
      const d = new Date(c.year, c.month + dir, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const t = new Date();
    setMonthCursor({ year: t.getFullYear(), month: t.getMonth() });
    if (windowKeys().has(todayKey())) {
      setActiveDate(todayKey());
      setSelectedSlotId(null);
      setFormError(null);
    }
  };

  const eventsByDate = createMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const ev of data()?.events ?? []) {
      const key = eventDateKey(ev.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const list of map.values())
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  });

  // Default to the first date that has a free slot.
  createEffect(() => {
    if (activeDate() || !data()) return;
    const byDate = eventsByDate();
    for (const d of days()) {
      const key = dateKeyOf(d);
      if (
        (byDate.get(key) ?? []).some(
          (e) => e.status === "available" && !isPastSlot(e),
        )
      ) {
        setActiveDate(key);
        return;
      }
    }
    // Fall back to today so the strip still shows slots (all booked).
    setActiveDate(dateKeyOf(new Date()));
  });

  const daySlots = createMemo(() => {
    const key = activeDate();
    if (!key) return [];
    return eventsByDate().get(key) ?? [];
  });

  const freeCount = createMemo(
    () =>
      daySlots().filter((e) => e.status === "available" && !isPastSlot(e))
        .length,
  );

  const selectedSlot = createMemo(
    () => (data()?.events ?? []).find((e) => e.id === selectedSlotId()) ?? null,
  );

  const activeDateLabel = createMemo(() => {
    const key = activeDate();
    if (!key) return "";
    const d = new Date(`${key}T00:00:00`);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (dateKeyOf(today) === key) return "Today";
    if (dateKeyOf(tomorrow) === key) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  });

  const pickSlot = (ev: ScheduleEvent) => {
    if (ev.status !== "available" || isPastSlot(ev)) return;
    setSelectedSlotId(ev.id);
    setFormError(null);
    guestHeadingRef?.focus();
  };

  const submitBooking = async (e: Event) => {
    e.preventDefault();
    const slot = selectedSlot();
    if (!slot || submitting()) return;
    setFormError(null);

    if (!name().trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email().trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!phone().trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/company/${encodeURIComponent(params.username)}/bookings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: slot.id,
            name: name().trim(),
            email: email().trim(),
            phone: phone().trim(),
            message: message().trim() || undefined,
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const link =
        typeof body?.meetUri === "string"
          ? body.meetUri
          : typeof body?.meetLink === "string"
            ? body.meetLink
            : null;
      setMeetLink(link);

      // Client-side ICS so guests can hold a pending request on their calendar.
      try {
        const start = new Date(`${slot.date}T${slot.startTime}`);
        const end = new Date(`${slot.date}T${slot.endTime}`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const { raw } = generateIcsInvite({
            summary: `Meeting with ${data()?.business.name ?? "business"}`,
            description:
              message().trim() ||
              `Meeting request with ${data()?.business.name ?? "business"}. Awaiting approval.`,
            organizer: {
              name: data()?.business.name ?? "",
              email: "",
            },
            attendees: [{ name: name().trim(), email: email().trim() }],
            start,
            end,
          });
          setIcsHref(
            `data:text/calendar;charset=utf-8,${encodeURIComponent(raw)}`,
          );
        }
      } catch {
        // ICS is a nicety; the booking already succeeded.
      }

      setSubmitted(true);
      notify("success", "Request sent", "Awaiting approval from the owner.");
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setSubmitted(false);
    setSelectedSlotId(null);
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setFormError(null);
    setMeetLink(null);
    setIcsHref(null);
  };

  const business = () => data()?.business ?? null;
  const zone = () => business()?.timezone ?? null;

  return (
    <>
      <Title>
        {business() ? `Book a meeting — ${business()!.name}` : "Book a meeting"}
      </Title>
      <Meta
        name="description"
        content={
          business()
            ? `Book a meeting with ${business()!.name}. All times in ${tzLabel(zone())}.`
            : "Book a meeting."
        }
      />
      <AppToaster />

      <div class="hero-gradient flex min-h-dvh flex-col items-center bg-background px-4 py-8 sm:py-12">
        <div class="flex w-full max-w-2xl flex-col gap-4">
          <Show
            when={!data.loading}
            fallback={
              <div class="flex flex-col gap-4" aria-hidden="true">
                <div class="rounded-soft border border-border bg-card p-6 shadow-md">
                  <div class="flex items-center gap-4">
                    <Skeleton class="size-16 rounded-soft" />
                    <div class="grid flex-1 gap-2">
                      <Skeleton class="h-7 w-1/2" />
                      <Skeleton class="h-4 w-2/3" />
                    </div>
                  </div>
                </div>
                <div class="rounded-soft border border-border bg-card p-6 shadow-md">
                  <Skeleton class="h-6 w-40" />
                  <div class="mt-4 flex gap-2">
                    <Skeleton class="h-16 w-16 rounded-card" />
                    <Skeleton class="h-16 w-16 rounded-card" />
                    <Skeleton class="h-16 w-16 rounded-card" />
                    <Skeleton class="h-16 w-16 rounded-card" />
                  </div>
                </div>
              </div>
            }
          >
            <Show
              when={!data.error}
              fallback={
                <div class="rounded-soft border border-border bg-card p-6 shadow-md">
                  <WidgetError
                    message="Could not load the schedule. Check your connection and retry."
                    onRetry={() => refetch()}
                    retryLabel="Retry"
                  />
                </div>
              }
            >
              <Show
                when={data()}
                fallback={
                  <div class="e1-enter rounded-soft border border-border bg-card p-8 text-center shadow-md sm:p-10">
                    <div class="mx-auto mb-5 grid size-14 place-items-center rounded-soft bg-destructive-muted">
                      <AlertTriangle
                        class="size-7 text-destructive"
                        aria-hidden="true"
                      />
                    </div>
                    <h1 class="font-heading text-2xl font-semibold text-foreground">
                      Schedule not found
                    </h1>
                    <p class="mt-2 text-sm text-muted-foreground">
                      This business does not have a published schedule, or the
                      link is invalid. Check the link and try again.
                    </p>
                    <div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                      <a
                        href="/"
                        class="inline-flex h-14 items-center justify-center rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                      >
                        Home
                      </a>
                      <a
                        href="/marketplace"
                        class="inline-flex h-14 items-center justify-center rounded-control border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Find a business
                      </a>
                    </div>
                  </div>
                }
              >
                <Show
                  when={!submitted()}
                  fallback={
                    <div class="e1-enter rounded-soft border border-border bg-card p-8 text-center shadow-md sm:p-10">
                      <div class="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success-muted">
                        <CheckCircle2
                          class="size-7 text-success"
                          aria-hidden="true"
                        />
                      </div>
                      <h1 class="font-heading text-2xl font-semibold text-foreground">
                        Request sent, awaiting approval.
                      </h1>
                      <p class="mt-2 text-base text-muted-foreground">
                        Your request for{" "}
                        <strong class="font-medium text-foreground">
                          {activeDateLabel()}
                        </strong>{" "}
                        at{" "}
                        <strong class="font-medium tnum text-foreground">
                          {selectedSlot()?.startTime} –{" "}
                          {selectedSlot()?.endTime}
                        </strong>{" "}
                        ({tzLabel(zone())}) is with {business()?.name}. You will
                        receive an email once they respond.
                      </p>
                      <div class="mx-auto mt-6 grid max-w-sm gap-3">
                        <Show when={icsHref()}>
                          <a
                            href={icsHref()!}
                            download={`meeting-${selectedSlot()?.date}.ics`}
                            class="inline-flex h-14 items-center justify-center gap-2 rounded-control border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Download class="size-5" aria-hidden="true" />
                            Add to calendar (.ics)
                          </a>
                        </Show>
                        <Show when={meetLink()}>
                          <a
                            href={meetLink()!}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex h-14 items-center justify-center gap-2 rounded-control border border-border bg-card px-6 text-base font-medium text-primary transition-colors hover:bg-muted"
                          >
                            <Video class="size-5" aria-hidden="true" />
                            Join Google Meet
                          </a>
                        </Show>
                        <button
                          type="button"
                          onClick={resetFlow}
                          class="inline-flex h-14 items-center justify-center rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-hover"
                        >
                          Book another slot
                        </button>
                      </div>
                    </div>
                  }
                >
                  {/* Header — business + timezone (always shown, DS §6). */}
                  <header class="e1-enter rounded-soft border border-border bg-card p-6 text-center shadow-md sm:text-left">
                    <div class="flex flex-col items-center gap-4 sm:flex-row">
                      <Show
                        when={business()?.logo}
                        fallback={
                          <div
                            class="grid size-16 shrink-0 place-items-center rounded-soft bg-linear-to-br from-primary/10 to-purple/10 font-heading text-2xl font-semibold text-primary"
                            aria-hidden="true"
                          >
                            {business()?.name?.charAt(0) ?? "?"}
                          </div>
                        }
                      >
                        <img
                          src={business()!.logo!}
                          alt={`${business()?.name} logo`}
                          class="size-16 shrink-0 rounded-soft object-cover shadow-md"
                        />
                      </Show>
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                          <h1 class="font-heading text-2xl font-semibold text-foreground">
                            {business()?.name}
                          </h1>
                          <Show when={business()?.sector}>
                            <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              <Briefcase class="size-3" aria-hidden="true" />
                              {business()?.sector}
                            </span>
                          </Show>
                        </div>
                        <Show when={business()?.description}>
                          <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {business()?.description}
                          </p>
                        </Show>
                      </div>
                    </div>
                    <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                      <Clock class="size-4" aria-hidden="true" />
                      <span class="tnum">All times in {tzLabel(zone())}</span>
                    </p>
                  </header>

                  {/* Step 1 — month calendar (static grid, no scrolling). */}
                  <section
                    aria-labelledby="booking-date-heading"
                    class="rounded-soft border border-border bg-card p-6 shadow-md"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <h2
                        id="booking-date-heading"
                        class="font-heading text-lg font-semibold text-foreground"
                      >
                        1. Pick a day
                      </h2>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={goToday}
                          class="inline-flex min-h-11 items-center rounded-control border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Today
                        </button>
                        <div class="flex overflow-hidden rounded-card border border-border">
                          <button
                            type="button"
                            onClick={() => goMonth(-1)}
                            disabled={!canGoPrev()}
                            aria-label="Previous month"
                            class="grid size-11 place-items-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ChevronLeft class="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => goMonth(1)}
                            aria-label="Next month"
                            class="grid size-11 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ChevronRight class="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p class="tnum mt-1 text-sm font-medium text-foreground">
                      {monthLabel()}
                    </p>

                    <div class="mt-3 grid grid-cols-7 gap-1" aria-hidden="true">
                      <For each={["M", "T", "W", "T", "F", "S", "S"]}>
                        {(w) => (
                          <div class="py-1 text-center text-xs font-medium text-muted-foreground">
                            {w}
                          </div>
                        )}
                      </For>
                    </div>
                    <div
                      role="listbox"
                      aria-label="Available days"
                      class="grid grid-cols-7 gap-1"
                    >
                      <For each={calendarCells()}>
                        {(cell) => (
                          <Show
                            when={cell}
                            fallback={<div aria-hidden="true" />}
                          >
                            {(() => {
                              const c = cell!;
                              const slots = eventsByDate().get(c.key) ?? [];
                              const free = slots.filter(
                                (e) =>
                                  e.status === "available" && !isPastSlot(e),
                              ).length;
                              const inWindow = windowKeys().has(c.key);
                              const isPastDay = c.key < todayKey() || !inWindow;
                              const disabled = isPastDay;
                              const active =
                                activeDate() === c.key && !disabled;
                              const label = new Date(
                                `${c.key}T00:00:00`,
                              ).toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              });
                              return (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  disabled={disabled}
                                  aria-label={`${label}${disabled ? ", unavailable" : free > 0 ? `, ${free} free` : ", fully booked"}`}
                                  onClick={() => {
                                    setActiveDate(c.key);
                                    setSelectedSlotId(null);
                                    setFormError(null);
                                  }}
                                  class="flex min-h-11 flex-col items-center justify-center rounded-control border px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed motion-reduce:transition-none"
                                  classList={{
                                    "border-primary bg-primary/10 text-primary":
                                      active,
                                    "border-transparent text-foreground hover:border-primary/60 hover:bg-muted":
                                      !active && !disabled,
                                    "border-transparent text-muted-foreground/40":
                                      disabled,
                                    "ring-2 ring-primary/40":
                                      c.key === todayKey() && !active,
                                  }}
                                >
                                  <span class="tnum text-sm font-medium">
                                    {c.date.getDate()}
                                  </span>
                                  <Show when={!disabled}>
                                    <span
                                      class="size-1.5 rounded-full"
                                      classList={{
                                        "bg-success": free > 0,
                                        "bg-muted-foreground/40": free === 0,
                                      }}
                                      aria-hidden="true"
                                    />
                                  </Show>
                                </button>
                              );
                            })()}
                          </Show>
                        )}
                      </For>
                    </div>
                    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
                      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          class="size-2 rounded-full bg-success"
                          aria-hidden="true"
                        />
                        Free slots
                      </span>
                      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          class="size-2 rounded-full bg-muted-foreground/40"
                          aria-hidden="true"
                        />
                        Fully booked
                      </span>
                    </div>
                  </section>

                  {/* Step 2 — slot chips: icon + text label, never colour-only. */}
                  <section
                    aria-labelledby="booking-slot-heading"
                    class="rounded-soft border border-border bg-card p-6 shadow-md"
                  >
                    <div class="flex flex-wrap items-baseline justify-between gap-2">
                      <h2
                        id="booking-slot-heading"
                        class="font-heading text-lg font-semibold text-foreground"
                      >
                        2. Pick a time
                      </h2>
                      <p class="tnum text-sm text-muted-foreground">
                        {activeDateLabel()} · {freeCount()} free ·{" "}
                        {tzLabel(zone())}
                      </p>
                    </div>

                    <Show
                      when={daySlots().length > 0}
                      fallback={
                        <p class="mt-4 rounded-card bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                          No slots on this day. Pick another day above.
                        </p>
                      }
                    >
                      <fieldset class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <legend class="sr-only">
                          Time slots for {activeDateLabel()}
                        </legend>
                        <For each={daySlots()}>
                          {(ev) => {
                            const past = isPastSlot(ev);
                            const taken = ev.status === "booked";
                            const disabled = taken || past;
                            const pressed =
                              selectedSlotId() === ev.id && !disabled;
                            return (
                              <button
                                type="button"
                                disabled={disabled}
                                aria-pressed={pressed}
                                aria-label={`${ev.startTime} to ${ev.endTime}, ${past ? "past" : taken ? "booked" : "free"}`}
                                onClick={() => pickSlot(ev)}
                                class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed motion-reduce:transition-none"
                                classList={{
                                  "border-primary bg-primary text-primary-foreground shadow-sm":
                                    pressed,
                                  "border-input bg-background text-foreground hover:border-primary":
                                    !pressed && !disabled,
                                  "border-border bg-muted text-muted-foreground":
                                    disabled,
                                }}
                              >
                                <Show
                                  when={!disabled}
                                  fallback={
                                    <Lock
                                      class="size-4 shrink-0"
                                      aria-hidden="true"
                                    />
                                  }
                                >
                                  <Clock
                                    class="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                </Show>
                                <span class="tnum">{ev.startTime}</span>
                                <span
                                  classList={{
                                    "line-through": disabled,
                                  }}
                                >
                                  {past ? "Past" : taken ? "Booked" : "Free"}
                                </span>
                                <Show when={pressed}>
                                  <Check
                                    class="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      </fieldset>
                    </Show>

                    <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
                      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock class="size-3.5" aria-hidden="true" />
                        Free
                      </span>
                      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock class="size-3.5" aria-hidden="true" />
                        Booked
                      </span>
                      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true" class="line-through">
                          Past
                        </span>
                        Past
                      </span>
                    </div>
                  </section>

                  {/* Step 3 — guest details, inline (no modal). */}
                  <section
                    aria-labelledby="booking-details-heading"
                    class="rounded-soft border border-border bg-card p-6 shadow-md"
                  >
                    <h2
                      id="booking-details-heading"
                      ref={guestHeadingRef}
                      tabIndex={-1}
                      class="font-heading text-lg font-semibold text-foreground focus:outline-none"
                    >
                      3. Your details
                    </h2>
                    <Show
                      when={selectedSlot()}
                      fallback={
                        <p class="mt-3 flex items-center gap-2 rounded-card bg-muted px-4 py-4 text-sm text-muted-foreground">
                          <CalendarCheck
                            class="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          Select a free time above to continue.
                        </p>
                      }
                    >
                      <p class="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin class="size-4 shrink-0" aria-hidden="true" />
                        <strong class="font-medium text-foreground">
                          {activeDateLabel()}
                        </strong>
                        <span class="tnum">
                          {selectedSlot()?.startTime} –{" "}
                          {selectedSlot()?.endTime}
                        </span>
                        <span>· {tzLabel(zone())}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSlotId(null)}
                          class="ml-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Change
                        </button>
                      </p>

                      <form
                        aria-label="Booking details"
                        class="mt-4 grid gap-4"
                        onSubmit={submitBooking}
                      >
                        <div>
                          <label
                            for="booking-name"
                            class="mb-1.5 block text-base font-medium text-foreground"
                          >
                            Full name
                          </label>
                          <input
                            id="booking-name"
                            type="text"
                            autocomplete="name"
                            value={name()}
                            onInput={(e) => setName(e.currentTarget.value)}
                            placeholder="Aarav Sharma"
                            class={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label
                            for="booking-email"
                            class="mb-1.5 block text-base font-medium text-foreground"
                          >
                            Email address
                          </label>
                          <input
                            id="booking-email"
                            type="email"
                            autocomplete="email"
                            value={email()}
                            onInput={(e) => setEmail(e.currentTarget.value)}
                            placeholder="you@example.com"
                            aria-describedby={
                              formError() ? "booking-error" : undefined
                            }
                            class={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label
                            for="booking-phone"
                            class="mb-1.5 block text-base font-medium text-foreground"
                          >
                            Phone number
                          </label>
                          <input
                            id="booking-phone"
                            type="tel"
                            autocomplete="tel"
                            value={phone()}
                            onInput={(e) => setPhone(e.currentTarget.value)}
                            placeholder="+91 98765 43210"
                            class={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label
                            for="booking-message"
                            class="mb-1.5 block text-base font-medium text-foreground"
                          >
                            Message{" "}
                            <span class="font-normal text-muted-foreground">
                              (optional)
                            </span>
                          </label>
                          <textarea
                            id="booking-message"
                            value={message()}
                            onInput={(e) => setMessage(e.currentTarget.value)}
                            placeholder="What would you like to discuss?"
                            rows={3}
                            class={`${INPUT_CLASS} h-auto resize-y py-3.5`}
                          />
                        </div>

                        <Show when={formError()}>
                          <p
                            id="booking-error"
                            role="alert"
                            class="rounded-card border border-destructive/25 bg-destructive-muted px-4 py-3 text-sm text-destructive"
                          >
                            {formError()}
                          </p>
                        </Show>

                        <div class="sticky bottom-4 sm:static sm:bottom-auto">
                          <button
                            type="submit"
                            disabled={submitting()}
                            class="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Show
                              when={!submitting()}
                              fallback={
                                <span
                                  class="size-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                                  aria-hidden="true"
                                />
                              }
                            >
                              <CalendarCheck
                                class="size-5"
                                aria-hidden="true"
                              />
                            </Show>
                            {submitting()
                              ? "Sending…"
                              : "Confirm booking request"}
                          </button>
                        </div>
                        <p class="text-center text-xs text-muted-foreground/70">
                          The owner approves every request — nothing is booked
                          until you get a confirmation email.
                        </p>
                      </form>
                    </Show>
                  </section>

                  <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                    Powered by{" "}
                    <InlineCombinationMark class="h-3.5 w-auto text-muted-foreground/60" />
                  </p>
                </Show>
              </Show>
            </Show>
          </Show>
        </div>
      </div>
    </>
  );
}
