import { CalendarDays, ChevronLeft, ChevronRight, Lock } from "lucide-solid";
import { createMemo, createResource, For, Show, Suspense } from "solid-js";
import { Skeleton } from "~/components/ui/skeleton";
import { tzLabel } from "~/lib/timezone-label";
import type { CalendarEventTone } from "~/types";
import CalendarEvent from "./CalendarEvent";
import SectionShell from "./SectionShell";

interface WeeklyCalendarProps {
  weekOffset: number;
  onWeekChange: (change: number) => void;
  timezone?: string | null;
}

interface SlotData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  title?: string | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_START = 8;
const DAY_END = 20;
const SLOT_COUNT = DAY_END - DAY_START;
const SLOT_REM = 2.75;
const GRID_COLUMNS = "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";

async function fetchSlots(): Promise<SlotData[]> {
  if (typeof window === "undefined") return [];
  const res = await fetch("/api/marketplace/slots/mine");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.slots) ? data.slots : [];
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(hour: number) {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function WeeklyCalendar(props: WeeklyCalendarProps) {
  const [slots] = createResource(fetchSlots);

  const weekStart = () => {
    const today = new Date();
    const monday = getMonday(today);
    return addDays(monday, props.weekOffset * 7);
  };

  const weekDates = () => DAYS.map((_, index) => addDays(weekStart(), index));

  const weekRange = () =>
    `${formatMonthDay(weekStart())} - ${formatMonthDay(addDays(weekStart(), 6))}`;

  const isToday = (index: number) => {
    const today = new Date();
    const date = weekDates()[index];
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  };

  const hours = Array.from(
    { length: SLOT_COUNT + 1 },
    (_, index) => DAY_START + index,
  );
  const bodyHeight = `${SLOT_COUNT * SLOT_REM}rem`;
  const hourLines = `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${SLOT_REM}rem)`;

  const eventsForDay = (dayIndex: number) => {
    const date = weekDates()[dayIndex];
    const dateKey = formatDateKey(date);
    const daySlots = (slots.latest ?? []).filter((s) => {
      const slotDate = new Date(s.date);
      return formatDateKey(slotDate) === dateKey;
    });

    return daySlots.map((slot) => {
      const startMinutes = parseTimeToMinutes(slot.startTime);
      const endMinutes = parseTimeToMinutes(slot.endTime);
      const startHour = startMinutes / 60;
      const durationMinutes = endMinutes - startMinutes;

      let tone: CalendarEventTone = "primary";
      if (slot.isBooked) tone = "orange";

      return {
        id: slot.id,
        startHour,
        duration: durationMinutes,
        label: slot.title ?? (slot.isBooked ? "Booked" : "Available"),
        tone,
      };
    });
  };

  const offsetPercent = (startHour: number) =>
    ((startHour - DAY_START) / SLOT_COUNT) * 100;
  const heightPercent = (durationMinutes: number) =>
    (durationMinutes / (SLOT_COUNT * 60)) * 100;

  // DS §6: agenda list below `md`, week grid on `lg`. Both read from the
  // same slot resource so counts never diverge.
  const agendaItems = createMemo(() =>
    weekDates().flatMap((date, dayIndex) =>
      eventsForDay(dayIndex).map((event) => ({
        date,
        dayLabel: date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        ...event,
      })),
    ),
  );

  return (
    <SectionShell>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 class="font-heading text-lg font-semibold text-foreground">
            This Week at a Glance
          </h2>
          <p class="tnum mt-1 text-sm text-muted-foreground">
            {weekRange()} · {tzLabel(props.timezone)}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.weekOffset !== 0}>
            <button
              type="button"
              onClick={() => props.onWeekChange(-props.weekOffset)}
              class="inline-flex min-h-11 items-center rounded-control border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Today
            </button>
          </Show>
          <div class="flex overflow-hidden rounded-card border border-border">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => props.onWeekChange(-1)}
              class="grid min-h-11 min-w-11 place-items-center border-r border-border text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronLeft class="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => props.onWeekChange(1)}
              class="grid min-h-11 min-w-11 place-items-center text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronRight class="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div class="grid gap-3 p-5" aria-hidden="true">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-48 w-full" />
          </div>
        }
      >
        {/* Mobile agenda — list-only below `md`, 48px rows, tabular times. */}
        <div class="p-3 md:hidden">
          <Show
            when={agendaItems().length > 0}
            fallback={
              <p class="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No slots this week. Add a bookable window to open your calendar.
              </p>
            }
          >
            <ul class="grid gap-2">
              <For each={agendaItems()}>
                {(item) => (
                  <li class="flex min-h-12 items-center gap-3 rounded-card border border-border bg-card p-3">
                    <span
                      aria-hidden="true"
                      class={`size-2.5 shrink-0 rounded-full ${item.tone === "orange" ? "bg-warning" : "bg-primary"}`}
                    />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p class="tnum text-xs text-muted-foreground">
                        {item.dayLabel}
                      </p>
                    </div>
                    <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {item.tone === "orange" && (
                        <Lock class="size-3" aria-hidden="true" />
                      )}
                      {item.tone === "orange" ? "Booked" : "Free"}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        <div class="hidden overflow-x-auto px-5 pt-5 md:block">
          <div class="min-w-[44rem] pb-3">
            <div class={`${GRID_COLUMNS} border-b border-border pb-2`}>
              <div />
              <For each={DAYS}>
                {(day, index) => (
                  <div class="text-center">
                    <div
                      class={
                        isToday(index())
                          ? "text-xs font-medium tracking-wide text-primary uppercase"
                          : "text-xs font-medium tracking-wide text-muted-foreground uppercase"
                      }
                    >
                      {day}
                    </div>
                    <div
                      class={
                        isToday(index())
                          ? "mx-auto mt-1 grid size-7 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
                          : "mx-auto mt-1 grid size-7 place-items-center text-sm font-medium text-foreground"
                      }
                    >
                      {weekDates()[index()].getDate()}
                    </div>
                  </div>
                )}
              </For>
            </div>

            <div class={GRID_COLUMNS}>
              <div class="relative" style={{ height: bodyHeight }}>
                <For each={hours}>
                  {(hour, index) => (
                    <span
                      class="tnum absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
                      style={{ top: `${(index() / SLOT_COUNT) * 100}%` }}
                    >
                      {formatHour(hour)}
                    </span>
                  )}
                </For>
              </div>

              <For each={DAYS}>
                {(_day, index) => (
                  <div
                    class={`group/day relative border-r border-border/60 last:border-r-0 ${isToday(index()) ? "bg-primary/5" : ""}`}
                    style={{
                      height: bodyHeight,
                      "background-image": hourLines,
                    }}
                  >
                    <For each={eventsForDay(index())}>
                      {(event) => (
                        <CalendarEvent
                          class="inset-x-0.5"
                          style={{
                            top: `${offsetPercent(event.startHour)}%`,
                            height: `calc(${heightPercent(event.duration)}% - 0.125rem)`,
                            "min-height": "1.25rem",
                          }}
                          tone={event.tone}
                        >
                          <span class="truncate text-xs">{event.label}</span>
                        </CalendarEvent>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Suspense>

      <div class="hidden flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 pb-5 md:flex">
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarDays class="size-3.5 text-primary" aria-hidden="true" />
          <span class="size-2 rounded-full bg-primary" aria-hidden="true" />
          Free
        </span>
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock class="size-3.5 text-warning" aria-hidden="true" />
          <span class="size-2 rounded-full bg-warning" aria-hidden="true" />
          Booked
        </span>
      </div>
    </SectionShell>
  );
}

export default WeeklyCalendar;
