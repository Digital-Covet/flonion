import { For, Show, createMemo, createSignal } from "solid-js";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-solid";

interface ScheduleEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
  title?: string | null;
}

interface PublicScheduleCalendarProps {
  events: ScheduleEvent[];
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
}

type ViewMode = "week" | "month";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Convert to Mon=0
}

function PublicScheduleCalendar(props: PublicScheduleCalendarProps) {
  const [viewMode, setViewMode] = createSignal<ViewMode>("week");
  const [weekOffset, setWeekOffset] = createSignal(0);
  const [monthYear, setMonthYear] = createSignal<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [selectedDay, setSelectedDay] = createSignal<string | null>(null);

  const bookingStartHour = () => {
    const [h] = props.bookingStartTime.split(":").map(Number);
    return h;
  };

  const bookingEndHour = () => {
    const [h] = props.bookingEndTime.split(":").map(Number);
    return h;
  };

  const hours = createMemo(() => {
    const start = bookingStartHour();
    const end = bookingEndHour();
    const result: number[] = [];
    for (let h = start; h < end; h++) {
      result.push(h);
    }
    return result;
  });

  // Week view data
  const weekStart = createMemo(() => {
    const today = new Date();
    const monday = getMonday(today);
    return addDays(monday, weekOffset() * 7);
  });

  const weekDates = createMemo(() =>
    WEEKDAYS.map((_, i) => addDays(weekStart(), i))
  );

  const weekRange = createMemo(() =>
    `${formatMonthDay(weekStart())} - ${formatMonthDay(addDays(weekStart(), 6))}`
  );

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  };

  const eventsForDate = (date: Date): ScheduleEvent[] => {
    const key = formatDateKey(date);
    return props.events.filter((e) => formatDateKey(new Date(e.date)) === key);
  };

  const eventsForHour = (date: Date, hour: number): ScheduleEvent[] => {
    return eventsForDate(date).filter((e) => {
      const [h] = e.startTime.split(":").map(Number);
      return h === hour;
    });
  };

  // Month view data
  const monthDays = createMemo(() => {
    const { year, month } = monthYear();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: { date: Date; inMonth: boolean }[] = [];

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      const d = new Date(year, month, -(firstDay - i - 1));
      days.push({ date: d, inMonth: false });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), inMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), inMonth: false });
    }

    return days;
  });

  const navigateMonth = (direction: number) => {
    setMonthYear((prev) => {
      const newMonth = prev.month + direction;
      if (newMonth > 11) return { year: prev.year + 1, month: 0 };
      if (newMonth < 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: newMonth };
    });
  };

  const monthLabel = createMemo(() => {
    const { year, month } = monthYear();
    return new Date(year, month).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  });

  // Selected day detail
  const selectedDayEvents = createMemo(() => {
    const key = selectedDay();
    if (!key) return [];
    return props.events.filter((e) => formatDateKey(new Date(e.date)) === key);
  });

  return (
    <div class="rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm animate-[fade-in-up_0.4s_ease-out_0.1s_both]">
      {/* View Switcher & Navigation */}
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
        <div class="flex items-center gap-2">
          <Calendar class="size-5 text-primary" />
          <h2 class="font-heading text-lg font-semibold text-foreground">Schedule</h2>
        </div>

        <div class="flex items-center gap-3">
          {/* View Toggle */}
          <div class="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              class={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                viewMode() === "week"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              class={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                viewMode() === "month"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>

          {/* Navigation */}
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (viewMode() === "week") {
                  if (weekOffset() !== 0) setWeekOffset(0);
                } else {
                  setMonthYear(() => {
                    const now = new Date();
                    return { year: now.getFullYear(), month: now.getMonth() };
                  });
                }
              }}
              class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
            <div class="flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => {
                  if (viewMode() === "week") setWeekOffset((o) => o - 1);
                  else navigateMonth(-1);
                }}
                class="grid size-8 place-items-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft class="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewMode() === "week") setWeekOffset((o) => o + 1);
                  else navigateMonth(1);
                }}
                class="grid size-8 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Week View */}
      <Show when={viewMode() === "week"}>
        <div class="overflow-x-auto px-6 py-4">
          <div class="min-w-[40rem]">
            {/* Week header */}
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-medium text-foreground">{weekRange()}</p>
              <p class="text-xs text-muted-foreground">IST (UTC+5:30)</p>
            </div>

            {/* Day headers */}
            <div class="mb-1 grid grid-cols-[4rem_repeat(7,1fr)] gap-1">
              <div />
              <For each={weekDates()}>
                {(date) => (
                  <div class="text-center">
                    <div
                      class={`text-xs font-medium uppercase ${
                        isToday(date) ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {WEEKDAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]}
                    </div>
                    <div
                      class={`mx-auto mt-1 grid size-7 place-items-center rounded-full text-sm font-medium ${
                        isToday(date)
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Time grid */}
            <div class="grid grid-cols-[4rem_repeat(7,1fr)] gap-1">
              <For each={hours()}>
                {(hour) => (
                  <>
                    <div class="pr-2 text-right text-[11px] tabular-nums text-muted-foreground">
                      {formatHour(hour)}
                    </div>
                    <For each={weekDates()}>
                      {(date) => {
                        const dayEvents = eventsForHour(date, hour);
                        return (
                          <div class="min-h-[2.5rem] rounded-md border border-border/40 px-1 py-0.5">
                            <For each={dayEvents}>
                              {(event) => (
                                <div
                                  class={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    event.status === "available"
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  <span class="block truncate">
                                    {event.status === "available" ? "Open" : event.title || "Busy"}
                                  </span>
                                </div>
                              )}
                            </For>
                          </div>
                        );
                      }}
                    </For>
                  </>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Month View */}
      <Show when={viewMode() === "month"}>
        <div class="px-6 py-4">
          <p class="mb-3 text-sm font-medium text-foreground">{monthLabel()}</p>

          {/* Day headers */}
          <div class="mb-1 grid grid-cols-7 gap-1">
            <For each={WEEKDAYS}>
              {(day) => (
                <div class="py-1 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              )}
            </For>
          </div>

          {/* Calendar grid */}
          <div class="grid grid-cols-7 gap-1">
            <For each={monthDays()}>
              {({ date, inMonth }) => {
                const dateKey = formatDateKey(date);
                const dayEvents = eventsForDate(date);
                const availableCount = dayEvents.filter((e) => e.status === "available").length;
                const bookedCount = dayEvents.filter((e) => e.status === "booked").length;
                const today = isToday(date);

                return (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(dateKey)}
                    class={`relative flex flex-col items-center rounded-lg p-2 text-sm transition-colors ${
                      !inMonth
                        ? "text-muted-foreground/30"
                        : today
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted"
                    } ${selectedDay() === dateKey ? "ring-2 ring-primary" : ""}`}
                  >
                    <span class="text-xs">{date.getDate()}</span>
                    <Show when={inMonth && dayEvents.length > 0}>
                      <div class="mt-1 flex gap-0.5">
                        <Show when={availableCount > 0}>
                          <span class="size-1.5 rounded-full bg-green-500" />
                        </Show>
                        <Show when={bookedCount > 0}>
                          <span class="size-1.5 rounded-full bg-slate-400" />
                        </Show>
                      </div>
                      <span class="text-[9px] text-muted-foreground">
                        {availableCount} open
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Selected Day Detail (Month view) */}
      <Show when={selectedDay() && viewMode() === "month"}>
        <div class="border-t border-border/60 px-6 py-4">
          <p class="mb-3 text-sm font-medium text-foreground">
            {new Date(selectedDay() + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <Show
            when={selectedDayEvents().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">No slots available on this day.</p>
            }
          >
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              <For each={selectedDayEvents()}>
                {(event) => (
                  <div
                    class={`rounded-lg border px-3 py-2 text-sm ${
                      event.status === "available"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <p class="font-medium">
                      {event.startTime} - {event.endTime}
                    </p>
                    <p class="text-xs opacity-75">
                      {event.status === "available" ? "Open Slot" : event.title || "Booked"}
                    </p>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Legend */}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-6 py-3">
        <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-green-500" />
          Available
        </span>
        <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-slate-400" />
          Booked / Busy
        </span>
      </div>
    </div>
  );
}

export default PublicScheduleCalendar;
