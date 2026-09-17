import { DatePicker } from "@ark-ui/solid/date-picker";
import { Field } from "@ark-ui/solid/field";
import type { DateValue } from "@internationalized/date";
import {
  CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock,
  Lock,
  Plus,
} from "lucide-solid";
import {
  createResource,
  createSignal,
  For,
  Index,
  Show,
  Suspense,
} from "solid-js";
import { Portal } from "solid-js/web";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import { tzLabel } from "~/lib/timezone-label";
import SectionShell from "./SectionShell";

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  title?: string | null;
}

async function fetchMySlots(): Promise<Slot[]> {
  if (typeof window === "undefined") return [];
  const res = await fetch("/api/marketplace/slots/mine");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.slots) ? data.slots : [];
}

interface BookableWindowsProps {
  key?: number;
  timezone?: string | null;
}

function BookableWindows(props: BookableWindowsProps) {
  const [dateValue, setDateValue] = createSignal<DateValue[]>([]);
  const [newDate, setNewDate] = createSignal("");
  const [newStart, setNewStart] = createSignal("09:00");
  const [newEnd, setNewEnd] = createSignal("10:00");
  const [adding, setAdding] = createSignal(false);

  const [slots, { refetch }] = createResource(fetchMySlots);

  // Refetch when key changes
  createResource(
    () => props.key,
    () => refetch(),
  );

  const handleDateChange = (details: {
    value: DateValue[];
    valueAsString: string[];
  }) => {
    setDateValue(details.value);
    setNewDate(details.valueAsString[0] ?? "");
  };

  const handleAdd = async () => {
    if (!newDate()) return;
    if (typeof window === "undefined") return;
    setAdding(true);

    try {
      const res = await fetch("/api/marketplace/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: [
            {
              date: newDate(),
              startTime: newStart(),
              endTime: newEnd(),
            },
          ],
        }),
      });

      if (res.ok) {
        setDateValue([]);
        setNewDate("");
        setNewStart("09:00");
        setNewEnd("10:00");
        refetch();
        notify("success", "Slot added");
      } else {
        notify("error", "Couldn't add that slot");
      }
    } catch {
      notify("error", "Couldn't add that slot");
    } finally {
      setAdding(false);
    }
  };

  const isPast = (slot: Slot) => {
    const d = new Date(slot.date);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  return (
    <SectionShell class="flex flex-1 flex-col">
      <header class="border-b border-border p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <CalendarPlus class="size-5 text-secondary" aria-hidden="true" />
            Bookable Windows
          </h2>
          <span class="tnum inline-flex min-h-7 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
            <Clock class="size-3.5" aria-hidden="true" />
            {tzLabel(props.timezone)}
          </span>
        </div>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">
          Configure availability for external meetings. Times always show your
          timezone.
        </p>
      </header>
      <div class="flex flex-1 flex-col">
        <div class="flex max-h-80 flex-1 flex-col gap-2 overflow-y-auto px-5 pt-5">
          <Suspense
            fallback={
              <div class="grid gap-2" aria-hidden="true">
                <Skeleton class="h-16 w-full rounded-card" />
                <Skeleton class="h-16 w-full rounded-card" />
                <Skeleton class="h-16 w-full rounded-card" />
              </div>
            }
          >
            <Show
              when={!slots.loading}
              fallback={
                <div class="grid gap-2" aria-hidden="true">
                  <Skeleton class="h-16 w-full rounded-card" />
                  <Skeleton class="h-16 w-full rounded-card" />
                </div>
              }
            >
              <Show
                when={(slots.latest ?? []).length > 0}
                fallback={
                  <EmptyState
                    icon={CalendarPlus}
                    title="No bookable windows"
                    description="Add your first slot below. Partners can only book inside these windows."
                    class="py-6"
                  />
                }
              >
                <ul class="grid gap-2">
                  <For each={slots.latest ?? []}>
                    {(slot) => {
                      const d = new Date(slot.date);
                      const dateLabel = d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                      const past = isPast(slot);
                      return (
                        <li
                          class={`flex min-h-12 items-center justify-between gap-3 rounded-card border p-3 ${
                            past
                              ? "border-border bg-muted/50"
                              : "border-border bg-card"
                          }`}
                        >
                          <div class="min-w-0">
                            <p class="tnum text-sm font-medium text-foreground">
                              {slot.startTime} – {slot.endTime}{" "}
                              <span class="text-xs font-normal text-muted-foreground">
                                {tzLabel(props.timezone)}
                              </span>
                            </p>
                            <p class="tnum text-xs text-muted-foreground">
                              {dateLabel}
                            </p>
                            <Show when={slot.title}>
                              <p class="mt-0.5 truncate text-xs text-muted-foreground italic">
                                {slot.title}
                              </p>
                            </Show>
                          </div>
                          <Show
                            when={slot.isBooked}
                            fallback={
                              <Show
                                when={past}
                                fallback={
                                  <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
                                    <CheckCircle2
                                      class="size-3.5"
                                      aria-hidden="true"
                                    />
                                    Free
                                  </span>
                                }
                              >
                                <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  Past
                                </span>
                              </Show>
                            }
                          >
                            <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning">
                              <Lock class="size-3.5" aria-hidden="true" />
                              Booked
                            </span>
                          </Show>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>
            </Show>
          </Suspense>
        </div>

        <div class="m-5 rounded-card border border-dashed border-control p-4">
          <p class="mb-3 text-sm font-medium text-foreground">Add new slot</p>
          <div class="grid gap-3">
            <Field.Root>
              <Field.Label class="mb-1 block text-xs font-medium text-muted-foreground">
                Date
              </Field.Label>
              <DatePicker.Root
                value={dateValue()}
                onValueChange={handleDateChange}
                class="w-full"
              >
                <DatePicker.Control class="flex min-h-11 w-full items-center rounded-control border border-control bg-card px-3 text-sm outline-none transition-colors duration-150 motion-reduce:transition-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                  <DatePicker.Input class="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none" />
                  <DatePicker.Trigger
                    aria-label="Pick a date"
                    class="grid min-h-11 min-w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <CalendarIcon class="size-4" />
                  </DatePicker.Trigger>
                </DatePicker.Control>
                <Portal>
                  <DatePicker.Positioner>
                    <DatePicker.Content class="z-50 rounded-control border border-border bg-popover p-3 shadow-md">
                      <DatePicker.View view="day">
                        <DatePicker.Context>
                          {(context) => (
                            <>
                              <DatePicker.ViewControl class="flex items-center justify-between mb-2">
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-control px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronRightIcon class="size-4" />
                                </DatePicker.NextTrigger>
                              </DatePicker.ViewControl>
                              <DatePicker.Table>
                                <DatePicker.TableHead>
                                  <DatePicker.TableRow>
                                    <Index each={context().weekDays}>
                                      {(weekDay) => (
                                        <DatePicker.TableHeader class="text-xs font-medium text-muted-foreground text-center w-8">
                                          {weekDay().short}
                                        </DatePicker.TableHeader>
                                      )}
                                    </Index>
                                  </DatePicker.TableRow>
                                </DatePicker.TableHead>
                                <DatePicker.TableBody>
                                  <Index each={context().weeks}>
                                    {(week) => (
                                      <DatePicker.TableRow>
                                        <Index each={week()}>
                                          {(day) => (
                                            <DatePicker.TableCell value={day()}>
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 w-8 text-sm rounded-control data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:font-medium hover:bg-muted">
                                                {day().day}
                                              </DatePicker.TableCellTrigger>
                                            </DatePicker.TableCell>
                                          )}
                                        </Index>
                                      </DatePicker.TableRow>
                                    )}
                                  </Index>
                                </DatePicker.TableBody>
                              </DatePicker.Table>
                            </>
                          )}
                        </DatePicker.Context>
                      </DatePicker.View>
                      <DatePicker.View view="month">
                        <DatePicker.Context>
                          {(context) => (
                            <>
                              <DatePicker.ViewControl class="flex items-center justify-between mb-2">
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-control px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronRightIcon class="size-4" />
                                </DatePicker.NextTrigger>
                              </DatePicker.ViewControl>
                              <DatePicker.Table>
                                <DatePicker.TableBody>
                                  <Index
                                    each={context().getMonthsGrid({
                                      columns: 4,
                                      format: "short",
                                    })}
                                  >
                                    {(months) => (
                                      <DatePicker.TableRow>
                                        <Index each={months()}>
                                          {(month) => (
                                            <DatePicker.TableCell
                                              value={month().value}
                                            >
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 px-2 text-sm rounded-control data-[selected]:bg-primary data-[selected]:text-primary-foreground hover:bg-muted">
                                                {month().label}
                                              </DatePicker.TableCellTrigger>
                                            </DatePicker.TableCell>
                                          )}
                                        </Index>
                                      </DatePicker.TableRow>
                                    )}
                                  </Index>
                                </DatePicker.TableBody>
                              </DatePicker.Table>
                            </>
                          )}
                        </DatePicker.Context>
                      </DatePicker.View>
                      <DatePicker.View view="year">
                        <DatePicker.Context>
                          {(context) => (
                            <>
                              <DatePicker.ViewControl class="flex items-center justify-between mb-2">
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-control px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-control text-foreground hover:bg-muted">
                                  <ChevronRightIcon class="size-4" />
                                </DatePicker.NextTrigger>
                              </DatePicker.ViewControl>
                              <DatePicker.Table>
                                <DatePicker.TableBody>
                                  <Index
                                    each={context().getYearsGrid({
                                      columns: 4,
                                    })}
                                  >
                                    {(years) => (
                                      <DatePicker.TableRow>
                                        <Index each={years()}>
                                          {(year) => (
                                            <DatePicker.TableCell
                                              value={year().value}
                                            >
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 px-2 text-sm rounded-control data-[selected]:bg-primary data-[selected]:text-primary-foreground hover:bg-muted">
                                                {year().label}
                                              </DatePicker.TableCellTrigger>
                                            </DatePicker.TableCell>
                                          )}
                                        </Index>
                                      </DatePicker.TableRow>
                                    )}
                                  </Index>
                                </DatePicker.TableBody>
                              </DatePicker.Table>
                            </>
                          )}
                        </DatePicker.Context>
                      </DatePicker.View>
                    </DatePicker.Content>
                  </DatePicker.Positioner>
                </Portal>
              </DatePicker.Root>
            </Field.Root>

            <Field.Root>
              <Field.Label class="mb-1 block text-xs font-medium text-muted-foreground">
                Start Time ({tzLabel(props.timezone)})
              </Field.Label>
              <input
                type="time"
                value={newStart()}
                onInput={(e) => setNewStart(e.currentTarget.value)}
                class="tnum min-h-11 w-full rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label class="mb-1 block text-xs font-medium text-muted-foreground">
                End Time ({tzLabel(props.timezone)})
              </Field.Label>
              <input
                type="time"
                value={newEnd()}
                onInput={(e) => setNewEnd(e.currentTarget.value)}
                class="tnum min-h-11 w-full rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </Field.Root>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newDate() || adding()}
            class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus class="size-4" aria-hidden="true" />
            {adding() ? "Adding…" : "Add Slot"}
          </button>
        </div>
      </div>
    </SectionShell>
  );
}

export default BookableWindows;
