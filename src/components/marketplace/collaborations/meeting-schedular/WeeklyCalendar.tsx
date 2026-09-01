import { For, Show, createResource, createMemo } from "solid-js";
import { ChevronLeft, ChevronRight } from "lucide-solid";
import SectionShell from "./SectionShell";
import CalendarEvent from "./CalendarEvent";
import type { CalendarEventTone } from "~/types";

interface WeeklyCalendarProps {
  weekOffset: number;
  onWeekChange: (change: number) => void;
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

  const hours = Array.from({ length: SLOT_COUNT + 1 }, (_, index) => DAY_START + index);
  const bodyHeight = `${SLOT_COUNT * SLOT_REM}rem`;
  const hourLines = `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${SLOT_REM}rem)`;

  const eventsForDay = (dayIndex: number) => {
    const date = weekDates()[dayIndex];
    const dateKey = formatDateKey(date);
    const daySlots = (slots() ?? []).filter((s) => {
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

  const offsetPercent = (startHour: number) => ((startHour - DAY_START) / SLOT_COUNT) * 100;
  const heightPercent = (durationMinutes: number) =>
    (durationMinutes / (SLOT_COUNT * 60)) * 100;

  return (
    <SectionShell>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h3>This Week at a Glance</h3>
          <p class="mt-1 text-sm text-muted-foreground">{weekRange()} (IST)</p>
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
        <div class="min-w-[44rem] pb-3">
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
                        <span class="truncate text-[11px]">{event.label}</span>
                      </CalendarEvent>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 pb-5">
        <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-primary" />
          Available
        </span>
        <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-orange" />
          Booked
        </span>
      </div>
    </SectionShell>
  );
}

export default WeeklyCalendar;
