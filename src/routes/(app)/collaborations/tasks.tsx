import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import {
  IconCalendarEvent,
  IconChartBar,
  IconLayoutKanban,
  IconMoodSearch,
  IconPlus,
  IconTable,
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
import { focusRing } from "~/components/auth/AuthShell";
import { isLoading, settled } from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import { btnPrimary, Notice } from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { DoneCalendar } from "~/components/tasks/calendar";
import {
  ASSIGNEE_ALL,
  ASSIGNEE_ME,
  byColumn,
  COLUMN_LABEL,
  type ColumnSort,
  type CustomColumn,
  type CustomSection,
  canEditTask,
  clearTaskFieldValues,
  createTask,
  createTaskField,
  createTeamMeeting,
  DEFAULT_HEADINGS,
  DEFAULT_NONE_TITLE,
  deleteTask,
  deleteTaskField,
  deleteTeamMeeting,
  draftFrom,
  emptyDraft,
  emptyMeetingDraft,
  type FieldPlacement,
  filtersActive,
  groupByCustom,
  groupTasks,
  type HeadingKey,
  isOpen,
  isOverdue,
  isTaskListTab,
  isUpcoming,
  liveSorts,
  loadCustomAssign,
  loadCustomSections,
  loadHeadings,
  loadNoneTitle,
  loadTaskFields,
  loadTasks,
  loadTeamMeetings,
  type MeetingDraft,
  matchesView,
  meetingCountLabel,
  moveTask,
  newCustomSectionId,
  nextSorts,
  pruneCustomAssign,
  reorderTask,
  resolveIndex,
  type SortDir,
  saveCustomAssign,
  saveCustomSections,
  saveHeadings,
  saveNoneTitle,
  saveTaskFieldValue,
  setFieldValue,
  sortByColumns,
  sortMeetings,
  subtasksByParent,
  TASK_TABS,
  type Task,
  type TaskColumn,
  type TaskDraft,
  type TaskGroup,
  type TasksView,
  type TaskTab,
  type TeamMeeting,
  tableRows,
  taskCountLabel,
  tasksIn,
  updateTask,
  updateTaskField,
  type Viewer,
  viewFrom,
  viewParams,
  withoutColumnValues,
  workload,
} from "~/components/tasks/data";
import {
  DEFAULT_COLUMNS,
  type OptionalColumn,
  TableActions,
  type TableColumns,
  TableSkeleton,
  type TaskPatch,
  TaskTable,
} from "~/components/tasks/table";
import { TasksToolbar } from "~/components/tasks/toolbar";
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
  TasksToaster,
  tasksToaster,
  WorkloadPanel,
  WorkloadSkeleton,
} from "~/components/tasks/widgets";
import { canManageTeam } from "~/components/team/data";
import { cn } from "~/lib/cn";
import {
  convertFieldValue,
  type FieldType,
  type FieldValue,
  fieldTypeLabel,
} from "~/lib/task-fields";

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
  const info = () => business.latest;
  const members = () => info()?.teamMembers ?? [];
  const viewer = (): Viewer | undefined => {
    const b = info();
    return b
      ? { userId: b.currentUserId, isOwner: b.isOwner, role: b.role }
      : undefined;
  };

  const visible = () =>
    all().filter((t) => matchesView(t, view(), viewer()?.userId ?? "", now));
  /**
   * The done calendar follows the board's person, priority and search, but
   * not its due-date filter — "overdue" or "due today" would hide every
   * finished task.
   */
  const finishedScope = createMemo(() =>
    all().filter((t) =>
      matchesView(t, { ...view(), due: "all" }, viewer()?.userId ?? "", now),
    ),
  );
  const columns = createMemo(() => byColumn(visible()));
  /** Local custom sections (per business, localStorage) for Group by > Custom. */
  const businessId = () => info()?.businessId;
  const [customSections, setCustomSections] = createSignal<CustomSection[]>([]);
  const [customAssign, setCustomAssign] = createSignal<Record<string, string>>(
    {},
  );
  const [noneTitle, setNoneTitle] = createSignal(DEFAULT_NONE_TITLE);
  const [headings, setHeadings] =
    createSignal<Record<HeadingKey, string>>(DEFAULT_HEADINGS);
  const [tableColumns, setTableColumns] =
    createSignal<TableColumns>(DEFAULT_COLUMNS);
  // Load the local layout whenever the team changes; nothing fetches during
  // SSR, and localStorage is browser-only.
  createEffect(
    on(businessId, (id) => {
      setCustomSections(loadCustomSections(id));
      setCustomAssign(loadCustomAssign(id));
      setNoneTitle(loadNoneTitle(id));
      setHeadings(loadHeadings(id));
    }),
  );

  // ── Added columns (stored on the server, shared by the team) ────────
  const [fields, { refetch: refetchFields, mutate: mutateFields }] =
    createResource(ready, loadTaskFields);
  const addedColumns = () => settled(fields)?.columns ?? [];
  const fieldValues = () => settled(fields)?.values ?? {};
  /** Structure is for the owner and admins; the server checks the same rule. */
  const canManageColumns = () => canManageTeam(viewer());

  function failureReason(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  /** The columns sorted by, first to last; a deleted column's sort drops out. */
  const [sorts, setSorts] = createSignal<ColumnSort[]>([]);
  const activeSorts = () => liveSorts(sorts(), addedColumns());

  function sortColumn(key: string, dir: SortDir, mode: "replace" | "add") {
    setSorts(nextSorts(activeSorts(), key, dir, mode));
    announce(mode === "add" ? "Sort added" : "Table sorted");
  }

  function removeSort(key: string) {
    setSorts(activeSorts().filter((s) => s.key !== key));
    announce("Sort removed");
  }

  function clearSorts() {
    setSorts([]);
    announce("Sorts cleared");
  }

  function hideColumn(field: OptionalColumn) {
    setTableColumns((current) => ({ ...current, [field]: false }));
    announce(`${DEFAULT_HEADINGS[field]} column hidden`);
    notifySuccess(
      `${DEFAULT_HEADINGS[field]} column hidden`,
      'Bring it back from "Add column".',
    );
  }

  /** Runs a structure change, then reloads so order and values match the server. */
  async function changeStructure(
    run: () => Promise<unknown>,
    failure: string,
    success?: { title: string; description?: string },
  ) {
    try {
      await run();
      await refetchFields();
      if (success) {
        announce(success.title);
        notifySuccess(success.title, success.description);
      }
    } catch (error) {
      notifyError(failure, failureReason(error, "Try again."));
    }
  }

  const hasValues = (column: CustomColumn) =>
    Object.values(fieldValues()).some((cells) => column.id in cells);

  function addColumn(type: FieldType, placement: FieldPlacement = {}) {
    return changeStructure(async () => {
      const column = await createTaskField({ type }, placement);
      announce(`${column.title} column added`);
      notifySuccess(
        `${column.title} column added`,
        "Rename it by double-clicking its title.",
      );
    }, "We couldn't add that column");
  }

  function duplicateColumn(column: CustomColumn) {
    return changeStructure(async () => {
      const copy = await createTaskField(
        { duplicateOf: column.id },
        { afterId: column.id },
      );
      announce(`${copy.title} column added`);
      notifySuccess(`${copy.title} column added`, "Values were copied too.");
    }, "We couldn't duplicate that column");
  }

  function changeColumnType(column: CustomColumn, type: FieldType) {
    if (type === column.type) return;
    const lost = Object.values(fieldValues()).filter((cells) => {
      const value = cells[column.id];
      return (
        value !== undefined &&
        convertFieldValue(column.type, type, value) === null
      );
    }).length;
    if (
      lost > 0 &&
      !window.confirm(
        `${lost} ${lost === 1 ? "value" : "values"} in "${column.title}" can't be turned into ${fieldTypeLabel(type).toLowerCase()} and will be removed. Change the type anyway?`,
      )
    ) {
      return;
    }
    return changeStructure(
      () => updateTaskField(column.id, { type }),
      "We couldn't change that column's type",
      {
        title: `${column.title} is now a ${fieldTypeLabel(type).toLowerCase()} column`,
      },
    );
  }

  function moveColumn(column: CustomColumn, direction: "left" | "right") {
    return changeStructure(
      () => updateTaskField(column.id, { move: direction }),
      "We couldn't move that column",
    );
  }

  function clearColumn(column: CustomColumn) {
    if (
      hasValues(column) &&
      !window.confirm(`Remove every value in the "${column.title}" column?`)
    ) {
      return;
    }
    return changeStructure(
      () => clearTaskFieldValues(column.id),
      "We couldn't clear that column",
      { title: `${column.title} cleared` },
    );
  }

  async function renameColumn(id: string, title: string) {
    // Show the new name straight away; the server has the final say (a blank
    // name comes back as the type's own).
    mutateFields({
      columns: addedColumns().map((c) => (c.id === id ? { ...c, title } : c)),
      values: fieldValues(),
    });
    try {
      const saved = await updateTaskField(id, { title });
      mutateFields({
        columns: addedColumns().map((c) => (c.id === id ? saved : c)),
        values: fieldValues(),
      });
      announce(`Column renamed to ${saved.title}`);
    } catch (error) {
      refetchFields();
      notifyError(
        "We couldn't rename that column",
        failureReason(error, "Try again."),
      );
    }
  }

  async function deleteColumn(column: CustomColumn) {
    if (
      hasValues(column) &&
      !window.confirm(`Delete the "${column.title}" column and all its values?`)
    ) {
      return;
    }
    try {
      await deleteTaskField(column.id);
      mutateFields({
        columns: addedColumns().filter((c) => c.id !== column.id),
        values: withoutColumnValues(fieldValues(), column.id),
      });
      announce(`${column.title} column deleted`);
      notifySuccess(
        `${column.title} column deleted`,
        "Its values were removed.",
      );
    } catch (error) {
      notifyError(
        "We couldn't delete that column",
        failureReason(error, "Try again."),
      );
    }
  }

  async function changeField(
    task: Task,
    column: CustomColumn,
    value: FieldValue | null,
  ) {
    // Optimistic: the cell shows what was typed while the save is in flight,
    // and a refetch puts the truth back if the save fails.
    mutateFields({
      columns: addedColumns(),
      values: setFieldValue(fieldValues(), task.id, column.id, value),
    });
    try {
      await saveTaskFieldValue(task.id, column.id, value);
      announce(`${column.title} saved for ${task.title}`);
    } catch (error) {
      refetchFields();
      notifyError(
        "We couldn't save that change",
        failureReason(error, "Try again."),
      );
    }
  }

  function renameHeading(field: HeadingKey, title: string) {
    // Blank restores the default name.
    const next = { ...headings(), [field]: title || DEFAULT_HEADINGS[field] };
    setHeadings(next);
    saveHeadings(businessId(), next);
    announce(`Column renamed to ${next[field]}`);
  }

  function persistCustom(
    sections: CustomSection[],
    assign: Record<string, string>,
  ) {
    const id = businessId();
    saveCustomSections(id, sections);
    saveCustomAssign(id, assign);
  }

  // Once the fetched list has settled, drop assignments for tasks that no
  // longer exist (deleted elsewhere) or sections that were removed. Declared
  // after the load effect above so it sees this team's freshly loaded layout.
  createEffect(
    on([() => settled(tasks), businessId], ([list]) => {
      if (!list) return;
      const pruned = pruneCustomAssign(customAssign(), list, customSections());
      if (pruned) {
        setCustomAssign(pruned);
        persistCustom(customSections(), pruned);
      }
    }),
  );

  const groups = createMemo(() =>
    view().group === "custom"
      ? groupByCustom(
          tableRows(visible()),
          customSections(),
          customAssign(),
          view().sort,
          noneTitle(),
        ).map((group) => ({
          ...group,
          // Column sorts order the rows inside each section.
          tasks: sortByColumns(
            group.tasks,
            activeSorts(),
            addedColumns(),
            fieldValues(),
          ),
        }))
      : groupTasks(
          tableRows(visible()),
          view().group,
          view().sort,
          members(),
          now,
        ),
  );
  const subtasks = createMemo(() => subtasksByParent(all()));

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

  /** Visual toast to go with the screen-reader announcement. */
  function notifySuccess(title: string, description?: string) {
    tasksToaster.success({ title, description });
  }

  function notifyError(title: string, description?: string) {
    tasksToaster.error({ title, description });
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
      refetchFields();
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
    update({ assignee: ASSIGNEE_ALL, priority: "all", due: "all", q: "" });
    announce("Filters cleared");
    notifySuccess("Filters cleared");
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
      notifySuccess(`${task.title} moved to ${COLUMN_LABEL[column]}`);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "We couldn't move that task. It's back where it was.";
      batch(() => {
        mutateTasks(before);
        setRevertedId(taskId);
        // The board says it on the column; the table has no columns, so it
        // toasts at the top of the page.
        if (view().tab === "board") {
          setMoveErrors((errors) => ({ ...errors, [column]: reason }));
        } else {
          notifyError(`${task.title} could not be moved`, reason);
        }
      });
      announce(`${task.title} could not be moved and stayed where it was`);
      if (view().tab === "board") {
        notifyError(`${task.title} could not be moved`, reason);
      }
    } finally {
      setMovingId(null);
    }
  }

  // ── Creating and editing ────────────────────────────────────────────────

  /** Whoever the list is filtered to, else the person adding it. */
  function defaultAssignee(): string {
    const me = viewer()?.userId ?? "";
    const assignee =
      view().assignee !== ASSIGNEE_ALL && view().assignee !== ASSIGNEE_ME
        ? view().assignee
        : me;
    return members().some((m) => m.id === assignee)
      ? assignee
      : (members()[0]?.id ?? "");
  }

  function openNew(column: TaskColumn) {
    batch(() => {
      setEditing(null);
      setDraft({ ...emptyDraft(defaultAssignee()), column });
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
    if (!values.title.trim() || values.assigneeIds.length === 0) {
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
        notifySuccess(
          `${created.title} added`,
          `Now in ${COLUMN_LABEL[created.column]}.`,
        );
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
      notifySuccess(
        movedColumn ? `${saved.title} saved and moved` : `${saved.title} saved`,
        movedColumn ? `Now in ${COLUMN_LABEL[values.column]}.` : undefined,
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

  /**
   * A task typed into a group's "Add task" row. It takes that group's
   * defaults — its status, due period or person — so it appears where it
   * was typed rather than jumping elsewhere in the table.
   */
  async function quickAdd(group: TaskGroup, title: string): Promise<boolean> {
    const defaults = group.defaults ?? {};
    const values: TaskDraft = {
      ...emptyDraft(defaultAssignee()),
      ...defaults,
      title,
    };
    if (values.assigneeIds.length === 0) return false;

    try {
      const created = await createTask(values);
      mutateTasks([...all(), created]);
      // In custom mode the new task takes the section it was typed in, so it
      // appears where it was added rather than in No section.
      if (
        view().group === "custom" &&
        typeof group.customSectionId === "string"
      ) {
        setCustomAssign((assign) => {
          const next = {
            ...assign,
            [created.id]: group.customSectionId as string,
          };
          persistCustom(customSections(), next);
          return next;
        });
      }
      announce(`${created.title} added to ${group.label}`);
      notifySuccess(`${created.title} added`, `Now in ${group.label}.`);
      return true;
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "We couldn't add that task. Try again.";
      notifyError("We couldn't add that task", reason);
      return false;
    }
  }

  // ── Custom sections (local only) ────────────────────────────────────

  function createSection() {
    const sections = customSections();
    const n = sections.length + 1;
    const base = `New section${n > 1 ? ` ${n}` : ""}`;
    const section: CustomSection = { id: newCustomSectionId(), title: base };
    const next = [...sections, section];
    setCustomSections(next);
    persistCustom(next, customAssign());
    announce(`${base} added`);
    notifySuccess(`${base} added`, "Rename it by double-clicking its title.");
  }

  function renameSection(group: TaskGroup, title: string) {
    const sectionId = group.customSectionId;
    if (sectionId === null) {
      // The catch-all isn't a stored section; only its display name is.
      setNoneTitle(title);
      saveNoneTitle(businessId(), title);
      announce(`Section renamed to ${title || DEFAULT_NONE_TITLE}`);
      return;
    }
    if (typeof sectionId !== "string") return;
    const next = customSections().map((s) =>
      s.id === sectionId ? { ...s, title } : s,
    );
    setCustomSections(next);
    persistCustom(next, customAssign());
    announce(`Section renamed to ${title}`);
  }

  function deleteSection(group: TaskGroup) {
    const sectionId = group.customSectionId;
    if (typeof sectionId !== "string") return;
    const section = customSections().find((s) => s.id === sectionId);
    const next = customSections().filter((s) => s.id !== sectionId);
    setCustomAssign((assign) => {
      const rest: Record<string, string> = {};
      for (const [taskId, assigned] of Object.entries(assign)) {
        if (assigned !== sectionId) rest[taskId] = assigned;
      }
      persistCustom(next, rest);
      return rest;
    });
    setCustomSections(next);
    announce(
      section ? `${section.title} deleted` : "Section deleted",
      // Its tasks move to No section rather than disappearing.
    );
    notifySuccess(
      section ? `${section.title} deleted` : "Section deleted",
      "Its tasks moved to No section.",
    );
  }

  function moveToSection(task: Task, sectionId: string | null) {
    setCustomAssign((assign) => {
      const next = { ...assign };
      if (sectionId) next[task.id] = sectionId;
      else delete next[task.id];
      persistCustom(customSections(), next);
      return next;
    });
    const label =
      sectionId === null
        ? "No section"
        : (customSections().find((s) => s.id === sectionId)?.title ??
          "section");
    announce(`${task.title} moved to ${label}`);
    notifySuccess(`${task.title} moved`, `Now in ${label}.`);
  }

  /** A change made by double-clicking a cell in the main table. */
  async function editCell(task: Task, patch: TaskPatch): Promise<boolean> {
    try {
      // The column travels through the reorder endpoint (see saveTask), so
      // PATCH keeps the task where it is.
      const saved = await updateTask(task.id, {
        ...draftFrom(task),
        ...patch,
        column: task.column,
      });
      mutateTasks(all().map((t) => (t.id === saved.id ? saved : t)));
      announce(`${saved.title} saved`);
      notifySuccess(`${saved.title} saved`);
      return true;
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "We couldn't save that change. Try again.";
      notifyError("We couldn't save that change", reason);
      return false;
    }
  }

  /** A subtask typed under a task: it starts in To do with the parent's person. */
  async function addSubtask(parent: Task, title: string): Promise<boolean> {
    const values: TaskDraft = {
      ...emptyDraft(parent.assigneeId),
      title,
    };

    try {
      const created = await createTask(values, parent.id);
      mutateTasks([...all(), created]);
      announce(`${created.title} added under ${parent.title}`);
      notifySuccess(`${created.title} added`, `Under ${parent.title}.`);
      return true;
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "We couldn't add that subtask. Try again.";
      notifyError("We couldn't add that subtask", reason);
      return false;
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
        // Subtasks go with their parent, as they do in the database.
        mutateTasks(
          all().filter((t) => t.id !== task.id && t.parentId !== task.id),
        );
        // Drop stale local section assignments for the deleted rows.
        setCustomAssign((assign) => {
          if (!(task.id in assign)) return assign;
          const next = { ...assign };
          delete next[task.id];
          for (const t of all()) {
            if (t.parentId === task.id) delete next[t.id];
          }
          persistCustom(customSections(), next);
          return next;
        });
        setDeleting(null);
        closeDialog();
      });
      announce(`${task.title} deleted`);
      notifySuccess(`${task.title} deleted`);
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
      notifySuccess(`${created.title} scheduled`);
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
      notifySuccess(`${meeting.title} cancelled`);
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

  const NewTaskButton = () => (
    <button
      type="button"
      disabled={!canCreate()}
      onClick={() => openNew("todo")}
      class={cn(btnPrimary, "disabled:cursor-not-allowed disabled:opacity-60")}
    >
      <IconPlus aria-hidden="true" class="size-5" />
      New task
    </button>
  );

  /** Shared by the table and the kanban: same tasks, same empty states. */
  const NoTasksYet = () => (
    <div class="rounded-lg border border-border bg-surface">
      <EmptyState
        icon={IconLayoutKanban}
        title="No tasks yet"
        action={<NewTaskButton />}
      >
        Put the jobs your team keeps forgetting here — replying to this week's
        reviews, printing a fresh QR sheet, updating opening hours.
      </EmptyState>
    </div>
  );

  const NoMatches = () => (
    <div class="rounded-lg border border-border bg-surface">
      <EmptyState
        icon={IconMoodSearch}
        title="No tasks match"
        action={
          <button
            type="button"
            onClick={clearFilters}
            class="min-h-11 font-medium text-primary underline underline-offset-4"
          >
            Clear search and filters
          </button>
        }
      >
        Try other words, another person, or any priority rather than one.
      </EmptyState>
    </div>
  );

  return (
    <>
      <Title>Tasks · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-8">
        <header class="min-w-0">
          <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
            Tasks
          </h1>
          <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
            What your team is working on, who is carrying what, and the meetings
            you have with each other.
          </p>
        </header>

        <Show when={!!business.latest && !canCreate()}>
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
          class="flex flex-col gap-5"
        >
          {/* View switcher: one set of tasks, seen as a table or a board. */}
          <Tabs.List class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            <For each={TASK_TABS}>
              {(tab) => (
                <Tabs.Trigger
                  value={tab.value}
                  class={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-medium whitespace-nowrap text-text-muted",
                    "transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text",
                    "data-[selected]:bg-surface data-[selected]:text-text data-[selected]:shadow-[0_1px_3px_rgb(0_0_0/0.08)] data-[selected]:ring-1 data-[selected]:ring-border",
                    focusRing,
                  )}
                >
                  <Switch>
                    <Match when={tab.value === "table"}>
                      <IconTable aria-hidden="true" class="size-4.5" />
                    </Match>
                    <Match when={tab.value === "board"}>
                      <IconLayoutKanban aria-hidden="true" class="size-4.5" />
                    </Match>
                    <Match when={tab.value === "workload"}>
                      <IconChartBar aria-hidden="true" class="size-4.5" />
                    </Match>
                    <Match when={tab.value === "meetings"}>
                      <IconCalendarEvent aria-hidden="true" class="size-4.5" />
                    </Match>
                  </Switch>
                  {tab.label}
                  <Show when={tab.value === "table"}>
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

          <Show when={isTaskListTab(view().tab)}>
            <TasksToolbar
              view={view()}
              members={members()}
              viewerId={viewer()?.userId ?? ""}
              tableTools={view().tab === "table"}
              actions={
                view().tab === "table" &&
                tasks.state === "ready" &&
                all().length > 0 ? (
                  <TableActions
                    columns={tableColumns()}
                    onChange={(key, shown) =>
                      setTableColumns((current) => ({
                        ...current,
                        [key]: shown,
                      }))
                    }
                    isCustom={view().group === "custom"}
                    canCreateSection={canCreate()}
                    onCreateSection={createSection}
                    addedColumns={addedColumns().length}
                    canManageColumns={canManageColumns()}
                    onAddColumn={(type) => addColumn(type)}
                    sortCount={activeSorts().length}
                    onClearSorts={clearSorts}
                  />
                ) : undefined
              }
              canCreate={canCreate()}
              onNew={() => openNew("todo")}
              onUpdate={update}
              onClear={clearFilters}
            />

            <Show when={tasks.state === "ready" && all().length > 0}>
              <BoardSummary
                open={openCount()}
                overdue={overdueCount()}
                showing={visible().length}
                filtered={filtersActive(view())}
              />
            </Show>
          </Show>

          {/* ── Main table ─────────────────────────────────────────────── */}
          <Tabs.Content value="table" class="outline-none">
            <h2 class="sr-only">Main table</h2>
            <Switch>
              <Match when={isLoading(tasks)}>
                <TableSkeleton />
              </Match>

              <Match when={tasks.state === "errored"}>
                <WidgetError what="your tasks" onRetry={refetchTasks} />
              </Match>

              <Match when={all().length === 0}>
                <NoTasksYet />
              </Match>

              <Match when={visible().length === 0}>
                <NoMatches />
              </Match>

              <Match when={true}>
                <TaskTable
                  groups={groups()}
                  columns={tableColumns()}
                  headings={headings()}
                  onRenameHeading={renameHeading}
                  customColumns={addedColumns()}
                  canManageColumns={canManageColumns()}
                  fieldValues={fieldValues()}
                  onAddColumn={addColumn}
                  onRenameColumn={renameColumn}
                  onDeleteColumn={deleteColumn}
                  onFieldChange={changeField}
                  columnSorts={activeSorts()}
                  onSort={sortColumn}
                  onRemoveSort={removeSort}
                  onClearSorts={clearSorts}
                  onInsertColumn={addColumn}
                  onDuplicateColumn={duplicateColumn}
                  onChangeColumnType={changeColumnType}
                  onMoveColumn={moveColumn}
                  onClearColumn={clearColumn}
                  onHideColumn={hideColumn}
                  subtasks={subtasks()}
                  now={now}
                  movingId={movingId()}
                  canCreate={canCreate()}
                  canEdit={(task) => canEditTask(task, viewer())}
                  onOpen={openTask}
                  onStatus={(task, column) => move(task.id, column, null)}
                  onDelete={(task) => {
                    setDeleteError("");
                    setDeleting(task);
                  }}
                  onQuickAdd={quickAdd}
                  onAddSubtask={addSubtask}
                  members={members()}
                  onEdit={editCell}
                  isCustom={view().group === "custom"}
                  onCreateSection={createSection}
                  onRenameSection={renameSection}
                  onDeleteSection={deleteSection}
                  onMoveToSection={moveToSection}
                />
              </Match>
            </Switch>
          </Tabs.Content>

          {/* ── Kanban ─────────────────────────────────────────────────── */}
          <Tabs.Content value="board" class="flex flex-col gap-4 outline-none">
            <h2 class="sr-only">Kanban</h2>
            <p class="text-sm text-text-muted">
              Drag a card by its grip to move it, or open it to change anything
              about it. Only the assignee, an admin, or the owner can move a
              task.
            </p>

            <Switch>
              <Match when={isLoading(tasks)}>
                <BoardSkeleton />
              </Match>

              <Match when={tasks.state === "errored"}>
                <WidgetError what="your board" onRetry={refetchTasks} />
              </Match>

              <Match when={all().length === 0}>
                <NoTasksYet />
              </Match>

              <Match when={visible().length === 0}>
                <NoMatches />
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

            <Show when={settled(tasks) && all().length > 0}>
              <DoneCalendar
                tasks={finishedScope()}
                members={members()}
                now={now}
                filtered={filtersActive(view())}
                onOpen={openTask}
              />
            </Show>
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
                                notifyError(
                                  "We couldn't copy the link",
                                  "Open it with Join and copy it from there instead.",
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
                                notifyError(
                                  "We couldn't copy the link",
                                  "Open it with Join and copy it from there instead.",
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

      <TasksToaster />
    </>
  );
}
