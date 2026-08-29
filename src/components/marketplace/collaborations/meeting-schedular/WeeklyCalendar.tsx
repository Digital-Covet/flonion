import { For, Show } from "solid-js";
import { ChevronLeft, ChevronRight, Plus } from "lucide-solid";
import SectionShell from "./SectionShell";
import CalendarEvent from "./CalendarEvent";
import type { CalendarEventTone } from "~/types";

interface WeeklyCalendarProps {
  weekOffset: number;
  onWeekChange: (change: number) => void;
}

interface CalendarBlock {
  day: string;
  startHour: number;
  duration: number;
  label: string;
  tone: CalendarEventTone;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/* Visible day window: 9 AM - 5 PM. */
const DAY_START = 9;
const DAY_END = 17;
const SLOT_COUNT = DAY_END - DAY_START;
const SLOT_REM = 2.75;
const GRID_COLUMNS = "grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))]";

/* Anchor week starts Monday Oct 23 so every offset resolves to real dates. */
const BASE_MONDAY = new Date(2023, 9, 23);

const TONE_LEGEND: { label: string; dot: string }[] = [
  { label: "Confirmed", dot: "bg-primary" },
  { label: "Pending", dot: "bg-orange" },
  { label: "Unavailable", dot: "bg-muted-foreground/40" },
];

const events: CalendarBlock[] = [
  { day: "Tue", startHour: 9, duration: 60, label: "Blocked", tone: "muted" },
  { day: "Wed", startHour: 10, duration: 90, label: "Vendor Onboard", tone: "primary" },
  { day: "Thu", startHour: 12, duration: 60, label: "Contract Neg.", tone: "orange" },
  { day: "Fri", startHour: 9, duration: 480, label: "Out of Office", tone: "muted" },
];

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(hour: number) {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function formatTimeRange(startHour: number, duration: number) {
  const endMinutes = startHour * 60 + duration;
  const endHour = Math.floor(endMinutes / 60);
  const trailing = endMinutes % 60;
  const start = formatHour(startHour).replace(/ [AP]M$/, "");
  const end = trailing === 0
    ? formatHour(endHour)
    : `${formatHour(endHour).replace(/ [AP]M$/, "")}:${String(trailing).padStart(2, "0")}`;
  return `${start} - ${end}`;
}

function WeeklyCalendar(props: WeeklyCalendarProps) {
  const weekStart = () => addDays(BASE_MONDAY, props.weekOffset * 7);
  const weekDates = () => DAYS.map((_, index) => addDays(weekStart(), index));
  const weekRange = () =>
    `${formatMonthDay(weekStart())} - ${formatMonthDay(addDays(weekStart(), 6))}`;

  /* Tuesday of the anchor week stands in for "today". */
  const isToday = (index: number) => props.weekOffset === 0 && index === 1;

  const hours = Array.from({ length: SLOT_COUNT + 1 }, (_, index) => DAY_START + index);
  const bodyHeight = `${SLOT_COUNT * SLOT_REM}rem`;
  const hourLines = `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${SLOT_REM}rem)`;

  const eventsFor = (day: string) => events.filter(event => event.day === day);
  const offsetPercent = (startHour: number) => ((startHour - DAY_START) / SLOT_COUNT) * 100;
  const heightPercent = (duration: number) => (duration / (SLOT_COUNT * 60)) * 100;

  return (
    <SectionShell>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h3>This Week at a Glance</h3>
          <p class="mt-1 text-sm text-muted-foreground">{weekRange()}</p>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.weekOffset !== 0}>
            <button
              type="button"
              onClick={() => props.onWeekChange(-props.weekOffset)}
              class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
          </Show>
          <div class="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => props.onWeekChange(-1)}
              class="grid size-8 place-items-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft class="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => props.onWeekChange(1)}
              class="grid size-8 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight class="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div class="overflow-x-auto px-5 pt-5">
        {/* pb-3 leaves room for the last hour label, which hangs below the grid. */}
        <div class="min-w-[34rem] pb-3">
          {/* Day headers reuse the body column template so the two always line up. */}
          <div class={`${GRID_COLUMNS} border-b border-border pb-2`}>
            <div />
            <For each={DAYS}>
              {(day, index) => (
                <div class="text-center">
                  <div
                    class={
                      isToday(index())
                        ? "text-xs font-semibold tracking-wide text-primary uppercase"
                        : "text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    }
                  >
                    {day}
                  </div>
                  <div
                    class={
                      isToday(index())
                        ? "mx-auto mt-1 grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
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
                    class="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                    style={{ top: `${(index() / SLOT_COUNT) * 100}%` }}
                  >
                    {formatHour(hour)}
                  </span>
                )}
              </For>
            </div>

            <For each={DAYS}>
              {(day, index) => (
                <div
                  class={`group/day relative border-r border-border/60 last:border-r-0 ${isToday(index()) ? "bg-primary/5" : ""}`}
                  style={{ height: bodyHeight, "background-image": hourLines }}
                >
                  <For each={eventsFor(day)}>
                    {(event) => (
                      <CalendarEvent
                        class="inset-x-1"
                        style={{
                          top: `${offsetPercent(event.startHour)}%`,
                          height: `calc(${heightPercent(event.duration)}% - 0.25rem)`,
                          "min-height": "1.5rem",
                        }}
                        tone={event.tone}
                      >
                        <span class="truncate">{event.label}</span>
                        <Show when={event.duration >= 60}>
                          <span class="truncate text-[10px] font-normal opacity-75">
                            {formatTimeRange(event.startHour, event.duration)}
                          </span>
                        </Show>
                      </CalendarEvent>
                    )}
                  </For>

                  <Show when={eventsFor(day).length === 0}>
                    <button
                      type="button"
                      class="absolute inset-1 grid place-items-center rounded-md border border-dashed border-primary/30 bg-positive-muted text-xs font-medium text-primary opacity-0 transition-opacity group-hover/day:opacity-100 focus-visible:opacity-100"
                    >
                      <span class="flex items-center gap-1">
                        <Plus class="size-3.5" />
                        Book
                      </span>
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>

        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 pb-5">
        <For each={TONE_LEGEND}>
          {(item) => (
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class={`size-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          )}
        </For>
      </div>
    </SectionShell>
  );
}

export default WeeklyCalendar;
