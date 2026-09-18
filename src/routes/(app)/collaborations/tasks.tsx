import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import {
  IconCalendarEvent,
  IconLayoutKanban,
  IconMoodSearch,
  IconPlus,
  IconUsers,
} from "@tabler/icons-solidjs";
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useApp } from "~/components/app/context";
import { isLoading, settled } from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import {
  tabListClass,
  tabTriggerClass,
} from "~/components/marketplace/portfolio";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  SelectField,
} from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import {
  ASSIGNEE_ALL,
  assigneeOptions,
  byColumn,
  COLUMN_LABEL,
  canEditTask,
  createTask,
  createTeamMeeting,
  DUE_OPTIONS,
  type DueFilter,
  deleteTask,
  deleteTeamMeeting,
  draftFrom,
  emptyDraft,
  emptyMeetingDraft,
  filtersActive,
  isOpen,
  isOverdue,
  isUpcoming,
  loadTasks,
  loadTeamMeetings,
  type MeetingDraft,
  matchesView,
  meetingCountLabel,
  moveTask,
  PRIORITY_FILTER_OPTIONS,
  type PriorityFilter,
  reorderTask,
  resolveIndex,
  sortMeetings,
  TASK_TABS,
  type Task,
  type TaskColumn,
  type TaskDraft,
  type TasksView,
  type TaskTab,
  type TeamMeeting,
  taskCountLabel,
  tasksIn,
  updateTask,
  type Viewer,
  viewFrom,
  viewParams,
  workload,
} from "~/components/tasks/data";
import {
  Board,
  BoardSkeleton,
  BoardSummary,
  CancelMeetingDialog,
  DeleteTaskDialog,
  MeetingCard,
  MeetingDialog,
  MeetingsSkeleton,
  SectionHeading,
  TabCount,
  TaskDialog,
  WorkloadPanel,
  WorkloadSkeleton,
} from "~/components/tasks/widgets";
import { cn } from "~/lib/cn";

/**
 * Task board (spec §6, `/collaborations/tasks`).
 *
 * Three views of the same team: the kanban itself, who is carrying what, and
 * the meetings the team has with each other. Tasks and meetings load
 * separately, so a slow endpoint never blanks the page (spec §4.5).
 *
 * Members may only move and edit tasks assigned to them — the board shows a
 * lock rather than letting them start a request the API will refuse.
 */
export default function TasksPage() {
  const { business } = useApp();
  const [params, setParams] = useSearchParams();
  const view = createMemo(() => viewFrom(params));

  // API routes need the browser's cookies, so nothing fetches during SSR.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [tasks, { refetch: refetchTasks, mutate: mutateTasks }] =
    createResource(ready, loadTasks);
  const [meetings, { refetch: refetchMeetings, mutate: mutateMeetings }] =
    createResource(ready, loadTeamMeetings);

  const [message, setMessage] = createSignal("");
  /** Page-level news: copy failures and the like. */
  const [actionError, setActionError] = createSignal("");
  /** A failed move belongs on the column it failed in (spec §4.4). */
  const [moveErrors, setMoveErrors] = createSignal<
    Partial<Record<TaskColumn, string>>
  >({});
  const [movingId, setMovingId] = createSignal<string | null>(null);
  const [revertedId, setRevertedId] = createSignal<string | null>(null);

  /** The task the dialog is about; `null` with the dialog open means "new". */
  const [editing, setEditing] = createSignal<Task | null>(null);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [draft, setDraft] = createSignal<TaskDraft>(emptyDraft(""));
  const [saving, setSaving] = createSignal(false);
  const [dialogError, setDialogError] = createSignal("");

  const [deleting, setDeleting] = createSignal<Task | null>(null);
  const [deletePending, setDeletePending] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  const [meetingOpen, setMeetingOpen] = createSignal(false);
  const [meetingDraft, setMeetingDraft] = createSignal<MeetingDraft>(
    emptyMeetingDraft(),
  );
  const [meetingSaving, setMeetingSaving] = createSignal(false);
  const [meetingError, setMeetingError] = createSignal("");
  const [cancelling, setCancelling] = createSignal<TeamMeeting | null>(null);
  const [cancelPending, setCancelPending] = createSignal(false);
  const [cancelError, setCancelError] = createSignal("");
  /** Meeting ids mid-flight, so one row greys out without freezing the list. */
  const [workingMeetings, setWorkingMeetings] = createSignal<
    ReadonlySet<string>
  >(new Set());

  const now = new Date();

  const all = () => settled(tasks) ?? [];
  const info = () => settled(business);
  const members = () => info()?.teamMembers ?? [];
  const viewer = (): Viewer | undefined => {
    const b = info();
    return b
      ? { userId: b.currentUserId, isOwner: b.isOwner, role: b.role }
      : undefined;
  };

  const visible = () =>
    all().filter((t) => matchesView(t, view(), viewer()?.userId ?? "", now));
  const columns = createMemo(() => byColumn(visible()));

  const openCount = () => all().filter(isOpen).length;
  const overdueCount = () => all().filter((t) => isOverdue(t, now)).length;

  const allMeetings = () => sortMeetings(settled(meetings) ?? []);
  const upcoming = () => allMeetings().filter((m) => isUpcoming(m, now));
  const past = () =>
    allMeetings()
      .filter((m) => !isUpcoming(m, now))
      .reverse();

  /** No team members means no valid assignee, so creating would always fail. */
  const canCreate = () => members().length > 0;

  // Re-announce even when the text repeats, so the live region always fires.
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  // One announcement per settled load: what is waiting on the team.
  createEffect(
    on(
      () => settled(tasks),
      (list) => {
        if (!list) return;
        const open = list.filter(isOpen).length;
        const late = list.filter((t) => isOverdue(t, now)).length;
        announce(
          open === 0
            ? "Nothing is open on the board"
            : `${open} open ${taskCountLabel(open)}, ${late} overdue`,
        );
      },
      { defer: true },
    ),
  );

  // Team-mates move cards while the owner is on another tab, so a refocus
  // refetches rather than polling.
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refetchTasks();
      refetchMeetings();
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", onVisible),
    );
  });

  function update(next: Partial<TasksView>) {
    setParams(viewParams({ ...view(), ...next }), { replace: true });
  }

  function clearFilters() {
    update({ assignee: ASSIGNEE_ALL, priority: "all", due: "all" });
    announce("Filters cleared");
  }

  // ── Moving a card ───────────────────────────────────────────────────────

  /**
   * Applied straight away and rolled back if the PATCH fails, so a drag never
   * waits on the network. The board animates the card home on a failure and
   * the column says why (spec §4.4).
   */
  async function move(
    taskId: string,
    column: TaskColumn,
    beforeId: string | null,
  ) {
    const before = all();
    const task = before.find((t) => t.id === taskId);
    if (!task) return;

    const index = resolveIndex(before, taskId, column, beforeId);
    const after = moveTask(before, taskId, column, index);
    const landed = after.find((t) => t.id === taskId);
    if (
      !landed ||
      (landed.column === task.column && landed.position === task.position)
    ) {
      return;
    }

    batch(() => {
      setMoveErrors((errors) => ({ ...errors, [column]: undefined }));
      setRevertedId(null);
      setMovingId(taskId);
      mutateTasks(after);
    });

    try {
      await reorderTask(taskId, column, index);
      announce(`${task.title} moved to ${COLUMN_LABEL[column]}`);
    } catch (error) {
      batch(() => {
        mutateTasks(before);
        setRevertedId(taskId);
        setMoveErrors((errors) => ({
          ...errors,
          [column]:
            error instanceof Error
              ? error.message
              : "We couldn't move that task. It's back where it was.",
        }));
      });
      announce(`${task.title} could not be moved and stayed where it was`);
    } finally {
      setMovingId(null);
    }
  }

  // ── Creating and editing ────────────────────────────────────────────────

  function openNew(column: TaskColumn) {
    const me = viewer()?.userId ?? "";
    // Default to whoever the board is filtered to, else to the person adding it.
    const assignee =
      view().assignee !== ASSIGNEE_ALL && view().assignee !== "me"
        ? view().assignee
        : me;
    const fallback = members().some((m) => m.id === assignee)
      ? assignee
      : (members()[0]?.id ?? "");

    batch(() => {
      setEditing(null);
      setDraft({ ...emptyDraft(fallback), column });
      setDialogError("");
      setDialogOpen(true);
    });
  }

  function openTask(task: Task) {
    batch(() => {
      setEditing(task);
      setDraft(draftFrom(task));
      setDialogError("");
      setDialogOpen(true);
    });
  }

  function closeDialog() {
    batch(() => {
      setDialogOpen(false);
      setEditing(null);
      setDialogError("");
    });
  }

  async function saveTask() {
    const values = draft();
    if (!values.title.trim() || !values.assigneeId) {
      setDialogError("A task needs a title and someone to do it.");
      return;
    }

    setSaving(true);
    setDialogError("");

    try {
      const existing = editing();
      if (!existing) {
        const created = await createTask(values);
        mutateTasks([...all(), created]);
        announce(`${created.title} added to ${COLUMN_LABEL[created.column]}`);
        closeDialog();
        return;
      }

      // PATCH sets the column but not the position, which would leave two
      // cards fighting over the same slot. So the column change travels
      // through the reorder endpoint, which renumbers both sides.
      const movedColumn = existing.column !== values.column;
      const saved = await updateTask(existing.id, {
        ...values,
        column: existing.column,
      });

      let next = all().map((t) => (t.id === saved.id ? saved : t));

      if (movedColumn) {
        const index = tasksIn(next, values.column).filter(
          (t) => t.id !== saved.id,
        ).length;
        await reorderTask(saved.id, values.column, index);
        next = moveTask(next, saved.id, values.column, index);
      }

      mutateTasks(next);
      announce(
        movedColumn
          ? `${saved.title} saved and moved to ${COLUMN_LABEL[values.column]}`
          : `${saved.title} saved`,
      );
      closeDialog();
    } catch (error) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "We couldn't save that task. Try again.",
      );
      // The board may be half-moved after a failed reorder, so reload it.
      refetchTasks();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const task = deleting();
    if (!task) return;

    setDeletePending(true);
    setDeleteError("");

    try {
      await deleteTask(task.id);
      batch(() => {
        mutateTasks(all().filter((t) => t.id !== task.id));
        setDeleting(null);
        closeDialog();
      });
      announce(`${task.title} deleted`);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We couldn't delete that task. Try again.",
      );
    } finally {
      setDeletePending(false);
    }
  }

  // ── Team meetings ───────────────────────────────────────────────────────

  function openMeetingDialog() {
    batch(() => {
      setMeetingDraft(emptyMeetingDraft());
      setMeetingError("");
      setMeetingOpen(true);
    });
  }

  async function submitMeeting() {
    const values = meetingDraft();
    setMeetingSaving(true);
    setMeetingError("");

    try {
      const created = await createTeamMeeting(values);
      batch(() => {
        mutateMeetings([...allMeetings(), created]);
        setMeetingOpen(false);
      });
      announce(`${created.title} added to your team's meetings`);
    } catch (error) {
      setMeetingError(
        error instanceof Error
          ? error.message
          : "We couldn't schedule that meeting. Try again.",
      );
    } finally {
      setMeetingSaving(false);
    }
  }

  async function confirmCancelMeeting() {
    const meeting = cancelling();
    if (!meeting) return;

    setCancelPending(true);
    setCancelError("");
    setWorkingMeetings((ids) => new Set(ids).add(meeting.id));

    try {
      await deleteTeamMeeting(meeting.id);
      batch(() => {
        mutateMeetings(allMeetings().filter((m) => m.id !== meeting.id));
        setCancelling(null);
      });
      announce(`${meeting.title} cancelled`);
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : "We couldn't cancel that meeting. Try again.",
      );
    } finally {
      setCancelPending(false);
      setWorkingMeetings((ids) => {
        const next = new Set(ids);
        next.delete(meeting.id);
        return next;
      });
    }
  }

  /**
   * A component rather than a shared element: the same button appears in the
   * header and in two empty states, and one DOM node can only live in one of
   * them.
   */
  const NewTaskButton = (props: { secondary?: boolean }) => (
    <button
      type="button"
      disabled={!canCreate()}
      onClick={() => openNew("todo")}
      class={cn(
        props.secondary ? btnSecondary : btnPrimary,
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <IconPlus aria-hidden="true" class="size-5" />
      New task
    </button>
  );

  return (
    <>
      <Title>Tasks · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-8">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Tasks
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              What your team is working on, who is carrying what, and the
              meetings you have with each other.
            </p>
          </div>
          <div class="shrink-0">
            <NewTaskButton />
          </div>
        </header>

        <Show when={actionError()}>
          {(error) => <Notice tone="error">{error()}</Notice>}
        </Show>

        <Show when={business.state === "ready" && !canCreate()}>
          <Notice tone="info">
            Tasks are assigned to a team member, and your team is empty. Invite
            someone from{" "}
            <A
              href="/settings/team"
              class="font-medium underline underline-offset-4"
            >
              Team settings
            </A>{" "}
            to start using the board.
          </Notice>
        </Show>

        <Tabs.Root
          value={view().tab}
          onValueChange={(e) => update({ tab: e.value as TaskTab })}
          class="flex flex-col gap-6"
        >
          <Tabs.List class={tabListClass}>
            <For each={TASK_TABS}>
              {(tab) => (
                <Tabs.Trigger value={tab.value} class={tabTriggerClass}>
                  {tab.label}
                  <Show when={tab.value === "board"}>
                    <TabCount value={openCount()} />
                  </Show>
                  <Show when={tab.value === "workload"}>
                    <TabCount value={workload(all(), members(), now).length} />
                  </Show>
                  <Show when={tab.value === "meetings"}>
                    <TabCount value={upcoming().length} />
                  </Show>
                </Tabs.Trigger>
              )}
            </For>
          </Tabs.List>

          {/* ── Board ──────────────────────────────────────────────────── */}
          <Tabs.Content value="board" class="flex flex-col gap-4 outline-none">
            <SectionHeading
              id="board-heading"
              title="Board"
              lead="Drag a card by its grip to move it, or open it to change anything about it. Only the assignee, an admin, or the owner can move a task."
            />

            <div class="flex flex-wrap items-end gap-3">
              <SelectField
                label="Assigned to"
                options={assigneeOptions(members(), viewer()?.userId ?? "")}
                value={view().assignee}
                onChange={(assignee) => update({ assignee })}
                class="w-full sm:w-52"
              />
              <SelectField
                label="Priority"
                options={PRIORITY_FILTER_OPTIONS}
                value={view().priority}
                onChange={(priority) =>
                  update({ priority: priority as PriorityFilter })
                }
                class="w-full sm:w-44"
              />
              <SelectField
                label="Due"
                options={DUE_OPTIONS}
                value={view().due}
                onChange={(due) => update({ due: due as DueFilter })}
                class="w-full sm:w-44"
              />
              <Show when={filtersActive(view())}>
                <button
                  type="button"
                  onClick={clearFilters}
                  class={cn(btnSecondary, "min-h-11 px-4 text-sm")}
                >
                  Clear filters
                </button>
              </Show>
            </div>

            <Show when={tasks.state === "ready" && all().length > 0}>
              <BoardSummary
                open={openCount()}
                overdue={overdueCount()}
                showing={visible().length}
                filtered={filtersActive(view())}
              />
            </Show>

            <Switch>
              <Match when={isLoading(tasks)}>
                <BoardSkeleton />
              </Match>

              <Match when={tasks.state === "errored"}>
                <WidgetError what="your board" onRetry={refetchTasks} />
              </Match>

              <Match when={all().length === 0}>
                <div class="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={IconLayoutKanban}
                    title="No tasks yet"
                    action={<NewTaskButton />}
                  >
                    Put the jobs your team keeps forgetting on the board —
                    replying to this week's reviews, printing a fresh QR sheet,
                    updating opening hours.
                  </EmptyState>
                </div>
              </Match>

              <Match when={visible().length === 0}>
                <div class="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={IconMoodSearch}
                    title="No tasks match these filters"
                    action={
                      <button
                        type="button"
                        onClick={clearFilters}
                        class="min-h-11 font-medium text-primary underline underline-offset-4"
                      >
                        Clear filters
                      </button>
                    }
                  >
                    Try another person, or look at any priority rather than one.
                  </EmptyState>
                </div>
              </Match>

              <Match when={true}>
                <Board
                  columns={columns()}
                  viewer={viewer()}
                  now={now}
                  errors={moveErrors()}
                  movingId={movingId()}
                  revertedId={revertedId()}
                  canEdit={(task) => canEditTask(task, viewer())}
                  onOpen={openTask}
                  onCreate={openNew}
                  onMove={move}
                  announce={announce}
                />
              </Match>
            </Switch>
          </Tabs.Content>

          {/* ── Workload ───────────────────────────────────────────────── */}
          <Tabs.Content
            value="workload"
            class="flex flex-col gap-4 outline-none"
          >
            <SectionHeading
              id="workload-heading"
              title="Workload"
              lead="Open tasks per person, across the whole board — the board's filters don't apply here."
            />

            <Switch>
              <Match when={isLoading(tasks)}>
                <WorkloadSkeleton />
              </Match>

              <Match when={tasks.state === "errored"}>
                <WidgetError
                  what="your team's workload"
                  onRetry={refetchTasks}
                />
              </Match>

              <Match when={workload(all(), members(), now).length === 0}>
                <div class="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={IconUsers}
                    title="No team members yet"
                    action={
                      <A href="/settings/team" class={btnPrimary}>
                        Invite your team
                      </A>
                    }
                  >
                    Once someone joins, their open tasks show up here so you can
                    see who is behind before they say so.
                  </EmptyState>
                </div>
              </Match>

              <Match when={true}>
                <WorkloadPanel rows={workload(all(), members(), now)} />
              </Match>
            </Switch>
          </Tabs.Content>

          {/* ── Team meetings ──────────────────────────────────────────── */}
          <Tabs.Content
            value="meetings"
            class="flex flex-col gap-6 outline-none"
          >
            <SectionHeading
              id="meetings-heading"
              title="Team meetings"
              lead="Your own team's meetings. Partner requests live in the meeting scheduler."
              action={
                <button
                  type="button"
                  onClick={openMeetingDialog}
                  class={btnPrimary}
                >
                  <IconCalendarEvent aria-hidden="true" class="size-5" />
                  Schedule meeting
                </button>
              }
            />

            <Switch>
              <Match when={isLoading(meetings)}>
                <MeetingsSkeleton />
              </Match>

              <Match when={meetings.state === "errored"}>
                <WidgetError
                  what="your team's meetings"
                  onRetry={refetchMeetings}
                />
              </Match>

              <Match when={allMeetings().length === 0}>
                <div class="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={IconCalendarEvent}
                    title="No team meetings yet"
                    action={
                      <button
                        type="button"
                        onClick={openMeetingDialog}
                        class={btnPrimary}
                      >
                        Schedule one
                      </button>
                    }
                  >
                    A short weekly catch-up is usually enough — everyone on the
                    team sees it here, with a Meet link when Google is
                    connected.
                  </EmptyState>
                </div>
              </Match>

              <Match when={true}>
                <div class="flex flex-col gap-6">
                  <section
                    aria-label="Upcoming meetings"
                    class="flex flex-col gap-3"
                  >
                    <h3 class="font-display text-base font-semibold text-text">
                      Upcoming
                      <span class="ml-2 font-mono text-sm font-normal tabular-nums text-text-muted">
                        {upcoming().length}{" "}
                        {meetingCountLabel(upcoming().length)}
                      </span>
                    </h3>
                    <Show
                      when={upcoming().length > 0}
                      fallback={
                        <p class="text-sm text-text-muted">
                          Nothing is coming up.
                        </p>
                      }
                    >
                      <ul
                        aria-busy={meetings.state === "refreshing"}
                        class="flex flex-col gap-3"
                      >
                        <For each={upcoming()}>
                          {(meeting) => (
                            <MeetingCard
                              meeting={meeting}
                              past={false}
                              pending={workingMeetings().has(meeting.id)}
                              announce={announce}
                              onCancel={setCancelling}
                              onCopyFailed={() =>
                                setActionError(
                                  "We couldn't copy the link. Open it with Join and copy it from there instead.",
                                )
                              }
                            />
                          )}
                        </For>
                      </ul>
                    </Show>
                  </section>

                  <Show when={past().length > 0}>
                    <section
                      aria-label="Past meetings"
                      class="flex flex-col gap-3"
                    >
                      <h3 class="font-display text-base font-semibold text-text">
                        Finished
                      </h3>
                      <ul class="flex flex-col gap-3">
                        <For each={past().slice(0, 5)}>
                          {(meeting) => (
                            <MeetingCard
                              meeting={meeting}
                              past={true}
                              pending={workingMeetings().has(meeting.id)}
                              announce={announce}
                              onCancel={setCancelling}
                              onCopyFailed={() =>
                                setActionError(
                                  "We couldn't copy the link. Open it with Join and copy it from there instead.",
                                )
                              }
                            />
                          )}
                        </For>
                      </ul>
                    </section>
                  </Show>
                </div>
              </Match>
            </Switch>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <TaskDialog
        open={dialogOpen()}
        task={editing()}
        draft={draft()}
        members={members()}
        editable={
          editing() ? canEditTask(editing() as Task, viewer()) : canCreate()
        }
        pending={saving()}
        error={dialogError()}
        onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
        onSubmit={saveTask}
        onDelete={() => {
          setDeleteError("");
          setDeleting(editing());
        }}
        onClose={closeDialog}
      />

      <DeleteTaskDialog
        task={deleting()}
        pending={deletePending()}
        error={deleteError()}
        onConfirm={confirmDelete}
        onClose={() => {
          setDeleting(null);
          setDeleteError("");
        }}
      />

      <MeetingDialog
        open={meetingOpen()}
        draft={meetingDraft()}
        pending={meetingSaving()}
        error={meetingError()}
        onChange={(next) => setMeetingDraft((d) => ({ ...d, ...next }))}
        onSubmit={submitMeeting}
        onClose={() => setMeetingOpen(false)}
      />

      <CancelMeetingDialog
        meeting={cancelling()}
        pending={cancelPending()}
        error={cancelError()}
        onConfirm={confirmCancelMeeting}
        onClose={() => {
          setCancelling(null);
          setCancelError("");
        }}
      />
    </>
  );
}
