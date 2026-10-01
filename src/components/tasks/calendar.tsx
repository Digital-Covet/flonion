import { Progress } from "@ark-ui/solid/progress";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
} from "@tabler/icons-solidjs";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import type { TeamMember } from "~/components/app/context";
import { focusRing } from "~/components/auth/AuthShell";
import {
  assigneeNames,
  type CalendarDay,
  dayKey,
  finishedDayKey,
  finishedIn,
  finishersIn,
  monthGrid,
  monthKey,
  monthLabel,
  monthTallies,
  shiftMonth,
  type Task,
  taskCountLabel,
} from "~/components/tasks/data";
import { AssigneeMark, cardClass } from "~/components/tasks/widgets";
import { cn } from "~/lib/cn";

/**
 * The kanban's record of finished work: a month calendar of what reached
 * Done each day, who finished it, and a year of months to compare against.
 *
 * Every count is written out — the shading only repeats it (spec §1
 * anti-pattern 4).
 */

const iconButton = cn(
  "grid size-11 shrink-0 place-items-center rounded-md text-text",
  "transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
  focusRing,
);

/** Monday-first, matching `monthGrid`. 1 Jan 2024 was a Monday. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }),
);

const dayName = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

/** Shading steps, fixed rather than relative so a quiet month looks quiet. */
function shade(count: number): string {
  if (count >= 4) return "bg-success/45";
  if (count >= 2) return "bg-success/25";
  if (count === 1) return "bg-success/12";
  return "bg-surface";
}

export function DoneCalendar(props: {
  /** Already narrowed by the board's person, priority and search filters. */
  tasks: Task[];
  members: TeamMember[];
  now: Date;
  filtered: boolean;
  onOpen: (task: Task) => void;
}) {
  const current = monthKey(props.now);
  const today = dayKey(props.now);
  const [month, setMonth] = createSignal(current);
  /** A picked day narrows the list below; null lists the whole month. */
  const [day, setDay] = createSignal<string | null>(null);

  const weeks = createMemo(() => monthGrid(props.tasks, month()));
  const finished = createMemo(() => finishedIn(props.tasks, month()));
  const before = createMemo(
    () => finishedIn(props.tasks, shiftMonth(month(), -1)).length,
  );
  const people = createMemo(() =>
    finishersIn(props.tasks, month(), props.members),
  );
  // The strip ends at this month, unless the owner has paged back further
  // than it reaches — then it follows them.
  const tallies = createMemo(() =>
    monthTallies(
      props.tasks,
      month() < shiftMonth(current, -11) ? shiftMonth(month(), 11) : current,
    ),
  );
  const tallyMax = () => Math.max(1, ...tallies().map((t) => t.count));
  const peopleMax = () => Math.max(1, ...people().map((p) => p.count));

  const listed = () => {
    const picked = day();
    return picked
      ? finished().filter((t) => finishedDayKey(t) === picked)
      : finished();
  };

  function go(next: string) {
    batch(() => {
      setMonth(next);
      setDay(null);
    });
  }

  const change = () => finished().length - before();

  return (
    <section
      aria-labelledby="done-calendar-heading"
      class={cn(cardClass, "flex flex-col gap-5")}
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2
            id="done-calendar-heading"
            class="font-display text-lg font-semibold text-text md:text-xl"
          >
            Finished by month
          </h2>
          <p class="mt-1 max-w-[60ch] text-sm text-pretty text-text-muted">
            What reached Done each day, and who finished it.
            <Show when={props.filtered}>
              {" "}
              Follows the board's search and filters, except the due date.
            </Show>
          </p>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(shiftMonth(month(), -1))}
            class={iconButton}
            aria-label={`Previous month, ${monthLabel(shiftMonth(month(), -1))}`}
          >
            <IconChevronLeft aria-hidden="true" class="size-5" />
          </button>
          <p
            aria-live="polite"
            class="min-w-36 text-center font-display text-base font-semibold text-text"
          >
            {monthLabel(month())}
          </p>
          <button
            type="button"
            disabled={month() >= current}
            onClick={() => go(shiftMonth(month(), 1))}
            class={iconButton}
            aria-label={`Next month, ${monthLabel(shiftMonth(month(), 1))}`}
          >
            <IconChevronRight aria-hidden="true" class="size-5" />
          </button>
          <Show when={month() !== current}>
            <button
              type="button"
              onClick={() => go(current)}
              class="ml-1 min-h-11 rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              This month
            </button>
          </Show>
        </div>
      </div>

      <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="font-mono text-2xl font-medium tabular-nums text-text">
          {finished().length}
        </span>
        <span class="text-sm text-text-muted">
          {taskCountLabel(finished().length)} finished
        </span>
        <span class="text-sm text-text-muted">
          ·{" "}
          {change() === 0
            ? "same as"
            : `${Math.abs(change())} ${change() > 0 ? "more" : "fewer"} than`}{" "}
          {monthLabel(shiftMonth(month(), -1), true)}
        </span>
      </p>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* ── Month grid ─────────────────────────────────────────────── */}
        <div>
          <div
            aria-hidden="true"
            class="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-text-muted"
          >
            <For each={WEEKDAYS}>{(d) => <span>{d}</span>}</For>
          </div>
          <ul class="grid grid-cols-7 gap-1" aria-label={monthLabel(month())}>
            <For each={weeks().flat()}>
              {(cell) => (
                <DayCell
                  cell={cell}
                  today={cell.key === today}
                  future={cell.key > today}
                  selected={cell.key === day()}
                  onPick={() =>
                    setDay((d) => (d === cell.key ? null : cell.key))
                  }
                />
              )}
            </For>
          </ul>
        </div>

        {/* ── By person ──────────────────────────────────────────────── */}
        <div class="flex flex-col gap-3">
          <h3 class="font-display text-base font-semibold text-text">
            By person
          </h3>
          <Show
            when={people().length > 0}
            fallback={
              <p class="text-sm text-text-muted">
                Nobody finished a task this month.
              </p>
            }
          >
            <ul class="flex flex-col gap-3">
              <For each={people()}>
                {(person) => (
                  <li class="flex items-center gap-3">
                    <AssigneeMark member={person} class="size-8" />
                    <div class="min-w-0 flex-1">
                      <p class="flex items-baseline justify-between gap-2 text-sm">
                        <span class="truncate text-text">{person.name}</span>
                        <span class="shrink-0 font-mono tabular-nums text-text">
                          {person.count}
                        </span>
                      </p>
                      <Progress.Root
                        value={person.count}
                        max={peopleMax()}
                        aria-label={`${person.name}: ${person.count} ${taskCountLabel(person.count)} finished`}
                        class="mt-1"
                      >
                        <Progress.Track class="h-1.5 overflow-hidden rounded-full bg-primary-soft">
                          <Progress.Range class="h-full rounded-full bg-success transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none" />
                        </Progress.Track>
                      </Progress.Root>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>

      {/* ── Twelve months ──────────────────────────────────────────────── */}
      <div class="flex flex-col gap-2">
        <h3 class="font-display text-base font-semibold text-text">
          Month by month
        </h3>
        <ul class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          <For each={tallies()}>
            {(tally) => (
              <li class="min-w-11 flex-1">
                <button
                  type="button"
                  aria-pressed={tally.key === month()}
                  aria-label={`${monthLabel(tally.key)}: ${tally.count} ${taskCountLabel(tally.count)} finished`}
                  onClick={() => go(tally.key)}
                  class={cn(
                    "flex h-24 w-full flex-col items-center justify-end gap-1 rounded-md px-1 pb-1.5 text-xs",
                    "transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft",
                    tally.key === month() &&
                      "bg-primary-soft ring-1 ring-primary",
                    focusRing,
                  )}
                >
                  <span class="font-mono tabular-nums text-text">
                    {tally.count}
                  </span>
                  <span
                    aria-hidden="true"
                    class={cn(
                      "w-full max-w-6 rounded-sm",
                      tally.count > 0 ? "bg-success" : "bg-border",
                    )}
                    style={{
                      height: `${Math.max(2, (tally.count / tallyMax()) * 40)}px`,
                    }}
                  />
                  <span
                    class={cn(
                      "text-text-muted",
                      tally.key === month() && "font-medium text-text",
                    )}
                  >
                    {monthLabel(tally.key, true)}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>

      {/* ── What was finished ──────────────────────────────────────────── */}
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="font-display text-base font-semibold text-text">
            {(() => {
              const picked = day();
              return picked
                ? `Finished on ${dayName(picked)}`
                : `Finished in ${monthLabel(month())}`;
            })()}
          </h3>
          <Show when={day()}>
            <button
              type="button"
              onClick={() => setDay(null)}
              class="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Show the whole month
            </button>
          </Show>
        </div>

        <Show
          when={listed().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              Nothing was finished {day() ? "that day" : "this month"}.
            </p>
          }
        >
          <ul class="flex flex-col divide-y divide-border rounded-md border border-border">
            <For each={listed()}>
              {(task) => (
                <li>
                  <button
                    type="button"
                    onClick={() => props.onOpen(task)}
                    class={cn(
                      "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left",
                      "transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft",
                      focusRing,
                    )}
                  >
                    <IconCircleCheck
                      aria-hidden="true"
                      class="size-4.5 shrink-0 text-success"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm text-text">
                      {task.title}
                    </span>
                    <span class="hidden truncate text-sm text-text-muted sm:inline">
                      {assigneeNames(task)}
                    </span>
                    <span class="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                      {dayName(finishedDayKey(task) as string)}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </section>
  );
}

function DayCell(props: {
  cell: CalendarDay;
  today: boolean;
  future: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const count = () => props.cell.tasks.length;
  const base =
    "relative flex h-14 flex-col justify-between rounded-md p-1.5 text-left md:h-20 md:p-2";
  const dayNumber = () => (
    <span
      class={cn(
        "font-mono text-xs tabular-nums",
        props.today
          ? "grid size-5 place-items-center rounded-full bg-primary font-semibold text-primary-foreground"
          : "text-text-muted",
      )}
    >
      {props.cell.day}
    </span>
  );

  return (
    <li>
      <Show
        when={props.cell.inMonth && count() > 0}
        fallback={
          <div
            aria-hidden={!props.cell.inMonth}
            class={cn(
              base,
              props.cell.inMonth
                ? "border border-border bg-surface"
                : "opacity-40",
              props.future && "opacity-60",
            )}
          >
            {dayNumber()}
            <Show when={props.cell.inMonth}>
              <span class="sr-only">
                {dayName(props.cell.key)}
                {props.today ? ", today" : ""}: nothing finished
              </span>
            </Show>
          </div>
        }
      >
        <button
          type="button"
          aria-pressed={props.selected}
          aria-label={`${dayName(props.cell.key)}${props.today ? ", today" : ""}: ${count()} ${taskCountLabel(count())} finished`}
          onClick={() => props.onPick()}
          class={cn(
            base,
            "w-full border border-success/30",
            shade(count()),
            "transition-[box-shadow,filter] duration-[var(--duration-fast)] hover:brightness-95",
            props.selected && "ring-2 ring-primary",
            focusRing,
          )}
        >
          {dayNumber()}
          <span class="flex items-center gap-0.5 self-end text-text">
            <IconCircleCheck
              aria-hidden="true"
              class="hidden size-3.5 text-success sm:block"
            />
            <span class="font-mono text-sm font-medium tabular-nums">
              {count()}
            </span>
          </span>
        </button>
      </Show>
    </li>
  );
}
