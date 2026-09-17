import { createListCollection, Select } from "@ark-ui/solid/select";
import { Tabs } from "@ark-ui/solid/tabs";
import { A } from "@solidjs/router";
import { CalendarDays, KanbanSquare, Plus, Users } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import DailyWorkload from "~/components/marketplace/collaborations/task-workload/daily-workload";
import MeetingCard from "~/components/marketplace/collaborations/task-workload/meeting-card";
import TaskBoard from "~/components/marketplace/collaborations/task-workload/task-board";
import TaskDialog from "~/components/marketplace/collaborations/task-workload/task-dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton, WidgetError } from "~/components/ui/skeleton";
import { TaskProvider } from "~/stores/TaskProvider";
import { type Task, useTaskContext } from "~/stores/task-store";

const filterCollection = createListCollection({
  items: [
    { label: "Whole Team", value: "whole-team" },
    { label: "By Employee", value: "by-employee" },
  ],
});

type MeetingTab = "today" | "tomorrow" | "upcoming";

function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Flonion DS §6 — Tasks & Team Meetings.
 * - H1 + description, max 1280 container, medium density.
 * - Team meetings: Today / Tomorrow / Upcoming tabs that actually filter,
 *   with counts, empty states, and a View All link to the scheduler.
 * - Kanban on `lg`, column tabs on mobile (see TaskBoard).
 * - Members see edit only on assigned tasks (store-enforced + notice).
 * - All controls 44px+, 2px primary focus, E1 motion, per-widget states.
 */
function ProjectsContent() {
  const {
    meetings,
    filter,
    setFilter,
    canManageTasks,
    tasksLoading,
    tasksError,
    fetchTasks,
  } = useTaskContext();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false);
  const [editingTask, setEditingTask] = createSignal<Task | null>(null);
  const [meetingTab, setMeetingTab] = createSignal<MeetingTab>("today");

  const dayBuckets = createMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const inRange = (dateStr: string, from: Date, to: Date) => {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      return d >= from && d < to;
    };

    const list = meetings();
    const isToday = (m: { date: string }) => inRange(m.date, today, tomorrow);
    const isTomorrow = (m: { date: string }) =>
      inRange(m.date, tomorrow, dayAfter);
    const isUpcoming = (m: { date: string }) => {
      const d = new Date(m.date);
      if (Number.isNaN(d.getTime())) return false;
      return d >= dayAfter;
    };
    return {
      today: list.filter(isToday),
      tomorrow: list.filter(isTomorrow),
      upcoming: list.filter(isUpcoming),
    };
  });

  const visibleMeetings = () => dayBuckets()[meetingTab()];

  const meetingEmptyCopy: Record<MeetingTab, string> = {
    today: "No meetings scheduled for today.",
    tomorrow: "Nothing scheduled for tomorrow.",
    upcoming: "No upcoming meetings after tomorrow.",
  };

  return (
    <main class="e1-enter mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 bg-background p-4 text-foreground sm:p-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="flex items-center gap-1.5 text-xs font-medium tracking-wide text-secondary uppercase">
            <Users class="size-3.5" aria-hidden="true" />
            Collaborations
          </p>
          <h1 class="mt-1 font-heading text-3xl font-semibold text-foreground">
            Tasks & Team Meetings
          </h1>
          <p class="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Plan the week's work, track who owns what, and keep internal
            meetings in one place.
          </p>
        </div>
        <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Select.Root
            collection={filterCollection}
            value={[filter()]}
            onValueChange={(details) => {
              if (details.value[0]) {
                setFilter(details.value[0]);
              }
            }}
          >
            <Select.Label class="sr-only">Task scope</Select.Label>
            <Select.Control>
              <Select.Trigger class="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Select.ValueText placeholder="Select filter" />
              </Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content class="rounded-card border border-border bg-card p-1.5 shadow-lg">
                  {filterCollection.items.map((item) => (
                    <Select.Item
                      item={item}
                      class="min-h-11 rounded-control px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                    >
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
            <Select.HiddenSelect />
          </Select.Root>
          <button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus class="size-4" aria-hidden="true" />
            New Task
          </button>
        </div>
      </header>

      {/* Permission notice: assignees may edit their own tasks; only
          owners/admins manage the whole board. */}
      <Show when={!canManageTasks()}>
        <p
          role="note"
          class="flex items-start gap-2.5 rounded-card border border-secondary/25 bg-secondary/10 px-4 py-3 text-sm leading-6 text-foreground"
        >
          <Users
            size={16}
            class="mt-1 shrink-0 text-secondary"
            aria-hidden="true"
          />
          You can edit and move tasks assigned to you. Owners and admins can
          manage every task on this board.
        </p>
      </Show>

      <Show when={tasksError()}>
        <WidgetError
          message={tasksError()!}
          onRetry={() => fetchTasks()}
          retryLabel="Retry"
        />
      </Show>

      <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-4">
        <div class="flex min-w-0 flex-col gap-6 xl:col-span-3">
          <section
            aria-label="Team meetings"
            class="rounded-card border border-border bg-card p-5 shadow-sm"
          >
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <h2 class="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                <CalendarDays
                  class="shrink-0 text-primary"
                  size={20}
                  aria-hidden="true"
                />
                Team Meetings
                <A
                  class="tnum ml-1 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href="/collaborations/meeting-schedular"
                >
                  View All
                </A>
              </h2>

              <Tabs.Root
                value={meetingTab()}
                onValueChange={(details) =>
                  setMeetingTab(details.value as MeetingTab)
                }
              >
                <Tabs.List
                  aria-label="Meeting days"
                    class="flex gap-1 rounded-card border border-border bg-muted p-1"
                >
                  <Tabs.Trigger
                    value="today"
                    class="tnum inline-flex min-h-11 items-center rounded-control px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Today ({dayBuckets().today.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="tomorrow"
                    class="tnum inline-flex min-h-11 items-center rounded-control px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Tomorrow ({dayBuckets().tomorrow.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="upcoming"
                    class="tnum inline-flex min-h-11 items-center rounded-control px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Upcoming ({dayBuckets().upcoming.length})
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>
            </div>

            <Show
              when={visibleMeetings().length > 0}
              fallback={
                <EmptyState
                  icon={CalendarDays}
                  title="No meetings here"
                  description={`${meetingEmptyCopy[meetingTab()]} Internal sessions booked with the team appear in this tab.`}
                  primaryLabel="Open scheduler"
                  primaryHref="/collaborations/meeting-schedular"
                />
              }
            >
              <ul class="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <For each={visibleMeetings()}>
                  {(meeting) => (
                    <li class="min-w-0">
                      <MeetingCard meeting={meeting} />
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          <Show
            when={!tasksLoading()}
            fallback={
              <div
                class="flex gap-4 overflow-x-auto rounded-card border border-border bg-card p-5"
                aria-hidden="true"
              >
                <For each={Array.from({ length: 4 })}>
                  {() => (
                    <div class="grid min-w-64 flex-1 gap-3">
                      <Skeleton class="h-6 w-24" />
                      <Skeleton class="h-28 w-full rounded-card" />
                      <Skeleton class="h-28 w-full rounded-card" />
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <TaskBoard
              onAddTask={() => setIsCreateDialogOpen(true)}
              onEditTask={(task) => setEditingTask(task)}
            />
          </Show>
          <Show when={!tasksLoading() && !tasksError()}>
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KanbanSquare size={14} aria-hidden="true" />
              Tip: each card has a “Move to…” menu — the keyboard alternative to
              drag-and-drop.
            </p>
          </Show>
        </div>

        <aside class="min-w-0 xl:col-span-1">
          <DailyWorkload />
        </aside>
      </div>

      <TaskDialog
        open={isCreateDialogOpen()}
        onOpenChange={setIsCreateDialogOpen}
      />
      <TaskDialog
        open={!!editingTask()}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        task={editingTask()}
      />
    </main>
  );
}

export default function Projects() {
  return (
    <TaskProvider>
      <ProjectsContent />
    </TaskProvider>
  );
}
