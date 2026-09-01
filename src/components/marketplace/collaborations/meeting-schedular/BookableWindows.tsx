import { createSignal, createResource, For, Show } from "solid-js";
import { Index } from "solid-js";
import { Portal } from "solid-js/web";
import { Plus, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Clock } from "lucide-solid";
import { DatePicker } from "@ark-ui/solid/date-picker";
import { Field } from "@ark-ui/solid/field";
import type { DateValue } from "@internationalized/date";
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
  const res = await fetch("/api/marketplace/slots/mine");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.slots) ? data.slots : [];
}

interface BookableWindowsProps {
  key?: number;
}

function BookableWindows(props: BookableWindowsProps) {
  const [dateValue, setDateValue] = createSignal<DateValue[]>([]);
  const [newDate, setNewDate] = createSignal("");
  const [newStart, setNewStart] = createSignal("09:00");
  const [newEnd, setNewEnd] = createSignal("10:00");
  const [adding, setAdding] = createSignal(false);

  const [slots, { refetch }] = createResource(fetchMySlots);

  // Refetch when key changes
  createResource(() => props.key, () => refetch());

  const handleDateChange = (details: { value: DateValue[]; valueAsString: string[] }) => {
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
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <SectionShell class="flex flex-1 flex-col">
      <header class="border-b border-border p-5">
        <div class="flex items-center justify-between">
          <h3>Bookable Windows</h3>
          <span class="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Clock class="size-3" />
            IST
          </span>
        </div>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">
          Configure availability for external meetings.
        </p>
      </header>
      <div class="flex flex-1 flex-col gap-4 p-5">
        <Show
          when={!slots.loading}
          fallback={
            <p class="text-sm text-muted-foreground">Loading slots...</p>
          }
        >
          <For each={slots() ?? []}>
            {(slot) => {
              const d = new Date(slot.date);
              const dateLabel = d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div class="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p class="text-sm font-medium text-foreground">
                      {slot.startTime} - {slot.endTime} <span class="text-xs text-muted-foreground">IST</span>
                    </p>
                    <p class="text-xs text-muted-foreground">{dateLabel}</p>
                    <Show when={slot.title}>
                      <p class="mt-0.5 text-xs text-muted-foreground italic">{slot.title}</p>
                    </Show>
                  </div>
                  <Show when={slot.isBooked}>
                    <span class="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Booked
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>

        <div class="mt-auto rounded-lg border border-dashed border-border p-3">
          <p class="text-sm font-medium text-foreground mb-3">Add new slot</p>
          <div class="flex flex-col gap-3">
            <Field.Root>
              <Field.Label class="text-xs text-muted-foreground">Date</Field.Label>
              <DatePicker.Root
                value={dateValue()}
                onValueChange={handleDateChange}
                class="w-full"
              >
                <DatePicker.Control class="flex h-9 w-full items-center rounded-md border border-border bg-transparent px-3 text-sm outline-none transition-colors focus-within:ring-2 focus-within:ring-primary/20">
                  <DatePicker.Input class="flex-1 bg-transparent outline-none text-sm text-foreground" />
                  <DatePicker.Trigger class="flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <CalendarIcon class="size-4" />
                  </DatePicker.Trigger>
                </DatePicker.Control>
                <Portal>
                  <DatePicker.Positioner>
                    <DatePicker.Content class="z-50 rounded-lg border border-border bg-popover p-3 shadow-md">
                      <DatePicker.View view="day">
                        <DatePicker.Context>
                          {(context) => (
                            <>
                              <DatePicker.ViewControl class="flex items-center justify-between mb-2">
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-md px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
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
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 w-8 text-sm rounded-md data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:font-semibold hover:bg-muted">
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
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-md px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
                                  <ChevronRightIcon class="size-4" />
                                </DatePicker.NextTrigger>
                              </DatePicker.ViewControl>
                              <DatePicker.Table>
                                <DatePicker.TableBody>
                                  <Index each={context().getMonthsGrid({ columns: 4, format: "short" })}>
                                    {(months) => (
                                      <DatePicker.TableRow>
                                        <Index each={months()}>
                                          {(month) => (
                                            <DatePicker.TableCell value={month().value}>
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 px-2 text-sm rounded-md data-[selected]:bg-primary data-[selected]:text-primary-foreground hover:bg-muted">
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
                                <DatePicker.PrevTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
                                  <ChevronLeftIcon class="size-4" />
                                </DatePicker.PrevTrigger>
                                <DatePicker.ViewTrigger class="text-sm font-medium text-foreground hover:bg-muted rounded-md px-2 py-1">
                                  <DatePicker.RangeText />
                                </DatePicker.ViewTrigger>
                                <DatePicker.NextTrigger class="flex items-center justify-center h-7 w-7 rounded-md text-foreground hover:bg-muted">
                                  <ChevronRightIcon class="size-4" />
                                </DatePicker.NextTrigger>
                              </DatePicker.ViewControl>
                              <DatePicker.Table>
                                <DatePicker.TableBody>
                                  <Index each={context().getYearsGrid({ columns: 4 })}>
                                    {(years) => (
                                      <DatePicker.TableRow>
                                        <Index each={years()}>
                                          {(year) => (
                                            <DatePicker.TableCell value={year().value}>
                                              <DatePicker.TableCellTrigger class="flex items-center justify-center h-8 px-2 text-sm rounded-md data-[selected]:bg-primary data-[selected]:text-primary-foreground hover:bg-muted">
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
              <Field.Label class="text-xs text-muted-foreground">Start Time (IST)</Field.Label>
              <input
                type="time"
                value={newStart()}
                onInput={(e) => setNewStart(e.currentTarget.value)}
                class="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label class="text-xs text-muted-foreground">End Time (IST)</Field.Label>
              <input
                type="time"
                value={newEnd()}
                onInput={(e) => setNewEnd(e.currentTarget.value)}
                class="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20"
              />
            </Field.Root>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newDate() || adding()}
            class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <Plus class="size-4" />
            {adding() ? "Adding..." : "Add Slot"}
          </button>
        </div>
      </div>
    </SectionShell>
  );
}

export default BookableWindows;
