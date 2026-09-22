import type { TeamMember } from "~/components/app/context";
import { api } from "~/components/onboarding/ui";

/**
 * Task board state and fetching (spec §6, `/collaborations/tasks`: kanban,
 * workload, team meetings).
 *
 * Types and plain functions only — the page imports this module, so nothing
 * here may reach for Prisma or anything else that belongs on the server.
 */

// ─── Shapes ──────────────────────────────────────────────────────────────

/** Column ids are the server's, so they travel straight to the API. */
export type TaskColumn = "todo" | "in_progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high";

/** One row of `GET /api/tasks`. */
export type Task = {
  id: string;
  title: string;
  description: string | null;
  column: TaskColumn;
  priority: TaskPriority;
  /** ISO timestamp, or null when the task has no deadline. */
  dueDate: string | null;
  position: number;
  assigneeId: string;
  assignee: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/** One row of `GET /api/team-meetings`. */
export type TeamMeeting = {
  id: string;
  title: string;
  /** Stored as a timestamp; only the date part is meaningful. */
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetUri: string | null;
  createdAt: string;
};

/** What the signed-in user may do, from `GET /api/business`. */
export type Viewer = {
  userId: string;
  isOwner: boolean;
  role: string;
};

// ─── Columns & priorities ────────────────────────────────────────────────

export const COLUMNS = [
  { value: "todo", label: "To do", lead: "Not started yet" },
  { value: "in_progress", label: "In progress", lead: "Someone is on it" },
  { value: "waiting", label: "Waiting", lead: "Blocked on someone else" },
  { value: "done", label: "Done", lead: "Finished this week" },
] as const satisfies ReadonlyArray<{
  value: TaskColumn;
  label: string;
  lead: string;
}>;

export const COLUMN_LABEL: Record<TaskColumn, string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

export const COLUMN_VALUES = COLUMNS.map((c) => c.value);

export const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const satisfies ReadonlyArray<{ value: TaskPriority; label: string }>;

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** High sorts first inside a column summary; the board itself uses position. */
const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function isColumn(value: string): value is TaskColumn {
  return (COLUMN_VALUES as readonly string[]).includes(value);
}

// ─── View state ──────────────────────────────────────────────────────────

export const TASK_TABS = [
  { value: "table", label: "Main table" },
  { value: "board", label: "Kanban" },
  { value: "workload", label: "Workload" },
  { value: "meetings", label: "Team meetings" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type TaskTab = (typeof TASK_TABS)[number]["value"];

/** Views that list tasks, and so share the search / filter toolbar. */
export const isTaskListTab = (tab: TaskTab) =>
  tab === "table" || tab === "board";

export const SORT_OPTIONS = [
  { value: "manual", label: "Board order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Name (A–Z)" },
  { value: "newest", label: "Newest first" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const GROUP_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type GroupKey = (typeof GROUP_OPTIONS)[number]["value"];

export const ASSIGNEE_ALL = "all";
/** Shortcut for the owner's own work, which is what most visits are about. */
export const ASSIGNEE_ME = "me";

export const PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "Any priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type PriorityFilter = (typeof PRIORITY_FILTER_OPTIONS)[number]["value"];

export const DUE_OPTIONS = [
  { value: "all", label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due in 7 days" },
  { value: "none", label: "No due date" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type DueFilter = (typeof DUE_OPTIONS)[number]["value"];

export type TasksView = {
  tab: TaskTab;
  /** `all`, `me`, or a team member's user id. */
  assignee: string;
  priority: PriorityFilter;
  due: DueFilter;
  /** Free-text search over title and details. */
  q: string;
  sort: SortKey;
  group: GroupKey;
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * The whole view lives in the URL, so "Priya's overdue work" is a link the
 * owner can send to Priya.
 */
export function viewFrom(params: SearchParams): TasksView {
  return {
    tab: pick(
      one(params.tab),
      TASK_TABS.map((t) => t.value),
      "table",
    ),
    assignee: one(params.assignee)?.trim() || ASSIGNEE_ALL,
    priority: pick(
      one(params.priority),
      PRIORITY_FILTER_OPTIONS.map((o) => o.value),
      "all",
    ),
    due: pick(
      one(params.due),
      DUE_OPTIONS.map((o) => o.value),
      "all",
    ),
    q: (one(params.q) ?? "").slice(0, 100),
    sort: pick(
      one(params.sort),
      SORT_OPTIONS.map((o) => o.value),
      "manual",
    ),
    group: pick(
      one(params.group),
      GROUP_OPTIONS.map((o) => o.value),
      "due",
    ),
  };
}

/** Defaults drop out so a plain link stays clean. */
export function viewParams(view: TasksView) {
  return {
    tab: view.tab === "table" ? undefined : view.tab,
    assignee: view.assignee === ASSIGNEE_ALL ? undefined : view.assignee,
    priority: view.priority === "all" ? undefined : view.priority,
    due: view.due === "all" ? undefined : view.due,
    q: view.q.trim() ? view.q : undefined,
    sort: view.sort === "manual" ? undefined : view.sort,
    group: view.group === "due" ? undefined : view.group,
  };
}

/** How many filters are narrowing the list — the "Filter / 2" count. */
export function activeFilterCount(view: TasksView): number {
  return (
    Number(view.assignee !== ASSIGNEE_ALL) +
    Number(view.priority !== "all") +
    Number(view.due !== "all")
  );
}

/** Search counts as narrowing too: an empty result must offer a way back. */
export function filtersActive(view: TasksView): boolean {
  return activeFilterCount(view) > 0 || view.q.trim() !== "";
}

/** Assignee choices: everyone, me, then the rest of the team by name. */
export function assigneeOptions(members: TeamMember[], viewerId: string) {
  const others = members
    .filter((m) => m.id !== viewerId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({ value: m.id, label: m.name }));
  return [
    { value: ASSIGNEE_ALL, label: "Everyone" },
    { value: ASSIGNEE_ME, label: "Me" },
    ...others,
  ];
}

export function matchesView(
  task: Task,
  view: TasksView,
  viewerId: string,
  now = new Date(),
): boolean {
  if (view.assignee !== ASSIGNEE_ALL) {
    const wanted = view.assignee === ASSIGNEE_ME ? viewerId : view.assignee;
    if (task.assigneeId !== wanted) return false;
  }
  if (view.priority !== "all" && task.priority !== view.priority) return false;

  const q = view.q.trim().toLocaleLowerCase();
  if (
    q &&
    !task.title.toLocaleLowerCase().includes(q) &&
    !(task.description ?? "").toLocaleLowerCase().includes(q) &&
    !(task.assignee?.name ?? "").toLocaleLowerCase().includes(q)
  ) {
    return false;
  }

  switch (view.due) {
    case "overdue":
      return isOverdue(task, now);
    case "today":
      return Boolean(task.dueDate) && dueInDays(task, now) === 0;
    case "week": {
      const days = dueInDays(task, now);
      return days !== null && days >= 0 && days <= 7;
    }
    case "none":
      return !task.dueDate;
    default:
      return true;
  }
}

// ─── Permissions ─────────────────────────────────────────────────────────

/** Owners and admins manage the whole board (see lib/business-context.ts). */
export function canManage(viewer: Viewer | undefined): boolean {
  return Boolean(viewer && (viewer.isOwner || viewer.role === "admin"));
}

/**
 * Members may only touch tasks assigned to them — the same rule the API
 * enforces, mirrored here so the board shows a lock instead of failing a
 * request the person was never allowed to make (spec §6).
 */
export function canEditTask(task: Task, viewer: Viewer | undefined): boolean {
  if (!viewer) return false;
  return canManage(viewer) || task.assigneeId === viewer.userId;
}

// ─── Grouping ────────────────────────────────────────────────────────────

/** Tasks of one column, in board order. */
export function tasksIn(tasks: Task[], column: TaskColumn): Task[] {
  return tasks
    .filter((t) => t.column === column)
    .sort((a, b) => a.position - b.position);
}

export function byColumn(tasks: Task[]): Record<TaskColumn, Task[]> {
  return {
    todo: tasksIn(tasks, "todo"),
    in_progress: tasksIn(tasks, "in_progress"),
    waiting: tasksIn(tasks, "waiting"),
    done: tasksIn(tasks, "done"),
  };
}

/** Anything not finished — what "open work" means everywhere on this page. */
export function isOpen(task: Task): boolean {
  return task.column !== "done";
}

export function sortByUrgency(tasks: Task[], now = new Date()): Task[] {
  return [...tasks].sort((a, b) => {
    const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (overdue !== 0) return overdue;
    const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priority !== 0) return priority;
    const aDue = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
}

// ─── Table: sorting, grouping, timeline ──────────────────────────────────

const COLUMN_RANK: Record<TaskColumn, number> = {
  todo: 0,
  in_progress: 1,
  waiting: 2,
  done: 3,
};

const dueTime = (task: Task) =>
  task.dueDate ? Date.parse(task.dueDate) : Number.POSITIVE_INFINITY;

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const list = [...tasks];
  switch (sort) {
    case "due":
      return list.sort((a, b) => dueTime(a) - dueTime(b));
    case "priority":
      return list.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          dueTime(a) - dueTime(b),
      );
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
      return list.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    default:
      return list.sort(
        (a, b) =>
          COLUMN_RANK[a.column] - COLUMN_RANK[b.column] ||
          a.position - b.position,
      );
  }
}

/** Each group's rail colour. Every group also has a label, so colour is extra. */
export type GroupTone =
  | "error"
  | "primary"
  | "info"
  | "accent"
  | "secondary"
  | "success"
  | "muted";

export type TaskGroup = {
  key: string;
  label: string;
  tone: GroupTone;
  tasks: Task[];
  /**
   * What a task added from this group's "Add task" row starts with, so it
   * lands in the group it was added to. `null` hides the row: nothing can be
   * added straight into "Overdue".
   */
  defaults: Partial<TaskDraft> | null;
};

function endOfWeek(today: Date): Date {
  // Weeks run Monday–Sunday, like the meeting scheduler's.
  const day = today.getDay();
  const end = new Date(today);
  end.setDate(today.getDate() + (day === 0 ? 0 : 7 - day));
  return end;
}

const endOfMonth = (today: Date, ahead = 0) =>
  new Date(today.getFullYear(), today.getMonth() + ahead + 1, 0);

type DueBucket = {
  key: string;
  label: string;
  tone: GroupTone;
  /** Last day (inclusive) as `YYYY-MM-DD`; null for open-ended buckets. */
  until: string | null;
  quickAddDue: string | null;
};

function dueBuckets(now: Date): DueBucket[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = dayKey(endOfWeek(today));
  const month = dayKey(endOfMonth(today));
  const next = dayKey(endOfMonth(today, 1));
  const monthName = (ahead: number) =>
    new Date(
      today.getFullYear(),
      today.getMonth() + ahead,
      1,
    ).toLocaleDateString(undefined, { month: "long" });

  return [
    {
      key: "this_week",
      label: "This week",
      tone: "primary",
      until: week,
      quickAddDue: week,
    },
    // When the week runs into next month, "rest of the month" is empty and
    // simply doesn't render.
    {
      key: "this_month",
      label: `Later in ${monthName(0)}`,
      tone: "info",
      until: month,
      quickAddDue: month,
    },
    {
      key: "next_month",
      label: monthName(1),
      tone: "accent",
      until: next,
      quickAddDue: next,
    },
    {
      key: "later",
      label: "Later",
      tone: "secondary",
      until: null,
      quickAddDue: dayKey(endOfMonth(today, 2)),
    },
  ];
}

function groupByDue(tasks: Task[], now: Date): TaskGroup[] {
  const today = dayKey(now);
  const buckets = dueBuckets(now);

  const overdue: Task[] = [];
  const earlier: Task[] = [];
  const none: Task[] = [];
  const byBucket = new Map<string, Task[]>(buckets.map((b) => [b.key, []]));

  for (const task of tasks) {
    const key = dueDayKey(task);
    if (!key) {
      none.push(task);
    } else if (key < today) {
      (isOpen(task) ? overdue : earlier).push(task);
    } else {
      const bucket =
        buckets.find((b) => b.until !== null && key <= b.until) ??
        buckets[buckets.length - 1];
      byBucket.get(bucket.key)?.push(task);
    }
  }

  return [
    {
      key: "overdue",
      label: "Overdue",
      tone: "error",
      tasks: overdue,
      defaults: null,
    },
    ...buckets.map((b) => ({
      key: b.key,
      label: b.label,
      tone: b.tone,
      tasks: byBucket.get(b.key) ?? [],
      defaults: { dueDate: b.quickAddDue ?? "" },
    })),
    {
      key: "none",
      label: "No due date",
      tone: "muted",
      tasks: none,
      defaults: { dueDate: "" },
    },
    {
      key: "earlier",
      label: "Finished earlier",
      tone: "success",
      tasks: earlier,
      defaults: null,
    },
  ];
}

const STATUS_TONE: Record<TaskColumn, GroupTone> = {
  todo: "info",
  in_progress: "accent",
  waiting: "primary",
  done: "success",
};

/**
 * Rows grouped the way the owner asked. Empty groups are dropped, except the
 * ones that still accept new tasks when grouping by status or assignee —
 * there an empty "Waiting" or an idle team-mate is information too.
 */
export function groupTasks(
  tasks: Task[],
  group: GroupKey,
  sort: SortKey,
  members: TeamMember[],
  now = new Date(),
): TaskGroup[] {
  let groups: TaskGroup[];

  if (group === "status") {
    groups = COLUMNS.map((c) => ({
      key: c.value,
      label: c.label,
      tone: STATUS_TONE[c.value],
      tasks: tasks.filter((t) => t.column === c.value),
      defaults: { column: c.value },
    }));
  } else if (group === "assignee") {
    const people = new Map(members.map((m) => [m.id, m.name]));
    for (const t of tasks) {
      if (!people.has(t.assigneeId)) {
        people.set(t.assigneeId, t.assignee?.name ?? "Former team member");
      }
    }
    groups = [...people.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({
        key: id,
        label: name,
        tone: "primary" as const,
        tasks: tasks.filter((t) => t.assigneeId === id),
        // Only current members can be assigned new work.
        defaults: members.some((m) => m.id === id) ? { assigneeId: id } : null,
      }));
  } else {
    return groupByDue(tasks, now)
      .filter((g) => g.tasks.length > 0 || g.key === "this_week")
      .map((g) => ({ ...g, tasks: sortTasks(g.tasks, sort) }));
  }

  return groups
    .filter((g) => g.tasks.length > 0 || g.defaults !== null)
    .map((g) => ({ ...g, tasks: sortTasks(g.tasks, sort) }));
}

export type Timeline = {
  /** "9 Sep – 15 Sep", or null when there is no due date to draw to. */
  label: string | null;
  /** Share of the span already elapsed, 0–1. */
  progress: number;
  state: "done" | "late" | "active" | "none";
};

const shortDay = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

function rangeLabel(start: Date, end: Date): string {
  return typeof shortDay.formatRange === "function"
    ? shortDay.formatRange(start, end)
    : `${shortDay.format(start)} – ${shortDay.format(end)}`;
}

/**
 * A task's timeline runs from the day it was created to the day it is due —
 * the model has no separate start date. The fill shows how much of that
 * window has gone, which is what an owner scanning for trouble wants.
 */
export function timelineOf(task: Task, now = new Date()): Timeline {
  const dueKey = dueDayKey(task);
  if (!dueKey) return { label: null, progress: 0, state: "none" };

  const end = parseDayKey(dueKey);
  const created = new Date(task.createdAt);
  const start = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  );
  const from = start > end ? end : start;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const span = end.getTime() - from.getTime();
  const progress =
    span <= 0
      ? today >= end
        ? 1
        : 0
      : Math.min(1, Math.max(0, (today.getTime() - from.getTime()) / span));

  return {
    label:
      from.getTime() === end.getTime()
        ? shortDay.format(end)
        : rangeLabel(from, end),
    progress: isOpen(task) ? progress : 1,
    state: !isOpen(task) ? "done" : isOverdue(task, now) ? "late" : "active",
  };
}

/** The whole group's window: earliest start to latest due date. */
export function groupSpan(tasks: Task[]): string | null {
  const dated = tasks.filter((t) => t.dueDate);
  if (dated.length === 0) return null;
  const starts = dated.map((t) => {
    const d = new Date(t.createdAt);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  });
  const ends = dated.map((t) => parseDayKey(dueDayKey(t) as string).getTime());
  const from = new Date(Math.min(...starts, ...ends));
  const to = new Date(Math.max(...ends));
  return from.getTime() === to.getTime()
    ? shortDay.format(to)
    : rangeLabel(from, to);
}

/** Task counts per status, in board order, for a group's summary bar. */
export function statusMix(
  tasks: Task[],
): Array<{ column: TaskColumn; count: number }> {
  return COLUMNS.map((c) => ({
    column: c.value,
    count: tasks.filter((t) => t.column === c.value).length,
  })).filter((s) => s.count > 0);
}

// ─── Workload ────────────────────────────────────────────────────────────

export type WorkloadRow = {
  member: TeamMember;
  /** Tasks not in Done. The bar is drawn against the busiest person. */
  open: number;
  overdue: number;
  done: number;
  high: number;
};

/**
 * One row per team member, busiest first. Counts come from the tasks already
 * loaded for the board, so the tab costs no extra request — and everyone with
 * nothing on their plate still gets a row, which is the point of the view.
 */
export function workload(
  tasks: Task[],
  members: TeamMember[],
  now = new Date(),
): WorkloadRow[] {
  // Someone who has left the team can still own tasks, and `GET /api/business`
  // only lists current members — so anyone holding work is folded back in,
  // otherwise the rows quietly stop adding up to the board.
  const known = new Set(members.map((m) => m.id));
  const strays = new Map<string, TeamMember>();
  for (const task of tasks) {
    if (known.has(task.assigneeId) || strays.has(task.assigneeId)) continue;
    strays.set(task.assigneeId, {
      id: task.assigneeId,
      name: task.assignee?.name ?? "Former team member",
      email: task.assignee?.email ?? "",
      image: task.assignee?.image ?? null,
    });
  }

  const rows = [...members, ...strays.values()].map((member) => {
    const mine = tasks.filter((t) => t.assigneeId === member.id);
    const open = mine.filter(isOpen);
    return {
      member,
      open: open.length,
      overdue: open.filter((t) => isOverdue(t, now)).length,
      done: mine.length - open.length,
      high: open.filter((t) => t.priority === "high").length,
    };
  });

  return rows.sort(
    (a, b) =>
      b.overdue - a.overdue ||
      b.open - a.open ||
      a.member.name.localeCompare(b.member.name),
  );
}

/** Busiest open count, floored at 1 so an all-empty team draws no bars. */
export function busiest(rows: WorkloadRow[]): number {
  return Math.max(1, ...rows.map((r) => r.open));
}

/** Plain-language read of one person's load, for the row's own words. */
export function loadLabel(row: WorkloadRow): string {
  if (row.open === 0) return "Nothing open";
  if (row.overdue > 0) return "Behind";
  if (row.open >= 8) return "Heavy";
  if (row.open >= 4) return "Steady";
  return "Light";
}

// ─── Dates ───────────────────────────────────────────────────────────────

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Due dates are stored as timestamps but mean a calendar day, so the day is
 * read off the ISO string rather than from a parsed Date — otherwise a task
 * due "today" reads as yesterday for anyone west of UTC.
 */
export function dueDayKey(task: Task): string | null {
  return task.dueDate ? task.dueDate.slice(0, 10) : null;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today to the due date; negative when it has passed. */
export function dueInDays(task: Task, now = new Date()): number | null {
  const key = dueDayKey(task);
  if (!key) return null;
  const due = parseDayKey(key);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** A finished task is never overdue, however long it sat there. */
export function isOverdue(task: Task, now = new Date()): boolean {
  if (!isOpen(task)) return false;
  const days = dueInDays(task, now);
  return days !== null && days < 0;
}

/** "Due today", "2 days late", "Due 24 Sep" — words first, date second. */
export function dueLabel(task: Task, now = new Date()): string | null {
  const days = dueInDays(task, now);
  if (days === null) return null;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day late";
  if (days < -1) return `${Math.abs(days)} days late`;
  if (days <= 7) return `Due in ${days} days`;

  const key = dueDayKey(task);
  return key
    ? `Due ${parseDayKey(key).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })}`
    : null;
}

export function meetingDayKey(meeting: TeamMeeting): string {
  return meeting.date.slice(0, 10);
}

/** "Mon 21 Sep · 10:00–10:30" for a meeting row. */
export function meetingWhen(meeting: TeamMeeting): string {
  const date = parseDayKey(meetingDayKey(meeting)).toLocaleDateString(
    undefined,
    { weekday: "short", day: "numeric", month: "short" },
  );
  return `${date} · ${meeting.startTime}–${meeting.endTime}`;
}

/** Meetings that have not finished yet, soonest first. */
export function isUpcoming(meeting: TeamMeeting, now = new Date()): boolean {
  const end = new Date(`${meetingDayKey(meeting)}T${meeting.endTime}`);
  return Number.isNaN(end.getTime())
    ? parseDayKey(meetingDayKey(meeting)) >= new Date(dayKey(now))
    : end.getTime() >= now.getTime();
}

export function sortMeetings(meetings: TeamMeeting[]): TeamMeeting[] {
  return [...meetings].sort(
    (a, b) =>
      meetingDayKey(a).localeCompare(meetingDayKey(b)) ||
      a.startTime.localeCompare(b.startTime),
  );
}

// ─── Counting ────────────────────────────────────────────────────────────

export const taskCountLabel = (n: number) => (n === 1 ? "task" : "tasks");

export const meetingCountLabel = (n: number) =>
  n === 1 ? "meeting" : "meetings";

// ─── Fetching ────────────────────────────────────────────────────────────

export type TaskDraft = {
  title: string;
  description: string;
  column: TaskColumn;
  priority: TaskPriority;
  /** `YYYY-MM-DD` from a date input, or "" for no deadline. */
  dueDate: string;
  assigneeId: string;
};

export function emptyDraft(assigneeId: string): TaskDraft {
  return {
    title: "",
    description: "",
    column: "todo",
    priority: "medium",
    dueDate: "",
    assigneeId,
  };
}

export function draftFrom(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    column: task.column,
    priority: task.priority,
    dueDate: dueDayKey(task) ?? "",
    assigneeId: task.assigneeId,
  };
}

/** Midday local time, so the stored timestamp never lands on the day before. */
function dueDatePayload(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

export async function loadTasks(): Promise<Task[]> {
  const res = await api<Task[]>("/api/tasks");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load tasks");
  return (res.data as Task[]) ?? [];
}

export async function loadTeamMeetings(): Promise<TeamMeeting[]> {
  const res = await api<TeamMeeting[]>("/api/team-meetings");
  if (!res.ok) {
    throw new Error(res.data.error ?? "Failed to load team meetings");
  }
  return (res.data as TeamMeeting[]) ?? [];
}

export async function createTask(draft: TaskDraft): Promise<Task> {
  const res = await api<Task>("/api/tasks", {
    method: "POST",
    body: {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      column: draft.column,
      priority: draft.priority,
      dueDate: dueDatePayload(draft.dueDate),
      assigneeId: draft.assigneeId,
    },
  });
  if (!res.ok) throw new Error(res.data.error ?? "Failed to create the task");
  return res.data as Task;
}

export async function updateTask(id: string, draft: TaskDraft): Promise<Task> {
  const res = await api<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      column: draft.column,
      priority: draft.priority,
      dueDate: dueDatePayload(draft.dueDate),
      assigneeId: draft.assigneeId,
    },
  });
  if (!res.ok) throw new Error(res.data.error ?? "Failed to save the task");
  return res.data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await api(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(res.data.error ?? "Failed to delete the task");
}

/**
 * Persists a move. The server renumbers the columns either side inside a
 * transaction, so the board only has to say where the card landed.
 */
export async function reorderTask(
  taskId: string,
  targetColumn: TaskColumn,
  newPosition: number,
): Promise<void> {
  const res = await api("/api/tasks/reorder", {
    method: "PATCH",
    body: { taskId, targetColumn, newPosition },
  });
  if (!res.ok) throw new Error(res.data.error ?? "Failed to move the task");
}

export type MeetingDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

export function emptyMeetingDraft(): MeetingDraft {
  return {
    title: "",
    date: "",
    startTime: "10:00",
    endTime: "10:30",
    location: "",
  };
}

export async function createTeamMeeting(
  draft: MeetingDraft,
): Promise<TeamMeeting> {
  const res = await api<TeamMeeting>("/api/team-meetings", {
    method: "POST",
    body: {
      title: draft.title.trim(),
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      location: draft.location.trim(),
    },
  });
  if (!res.ok) {
    throw new Error(res.data.error ?? "Failed to schedule the meeting");
  }
  return res.data as TeamMeeting;
}

export async function deleteTeamMeeting(id: string): Promise<void> {
  const res = await api(`/api/team-meetings/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(res.data.error ?? "Failed to cancel the meeting");
  }
}

// ─── Moving a card ───────────────────────────────────────────────────────

/**
 * The board's local model of a move: the card leaves its column, slots into
 * the target one, and both columns are renumbered from zero. The result is
 * applied optimistically and rolled back if the PATCH fails (spec §4.4).
 */
export function moveTask(
  tasks: Task[],
  taskId: string,
  targetColumn: TaskColumn,
  targetIndex: number,
): Task[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) return tasks;

  const source = tasksIn(tasks, moving.column).filter((t) => t.id !== taskId);
  const target =
    moving.column === targetColumn
      ? source
      : tasksIn(tasks, targetColumn).filter((t) => t.id !== taskId);

  const index = Math.max(0, Math.min(targetIndex, target.length));
  target.splice(index, 0, { ...moving, column: targetColumn });

  const renumbered = new Map<string, Task>();
  if (moving.column !== targetColumn) {
    source.forEach((t, i) => {
      renumbered.set(t.id, { ...t, position: i });
    });
  }
  target.forEach((t, i) => {
    renumbered.set(t.id, { ...t, column: targetColumn, position: i });
  });

  return tasks.map((t) => renumbered.get(t.id) ?? t);
}

/**
 * Turns "drop in front of this card" into the position the API wants.
 *
 * The board may be filtered, so its indexes are not the column's positions —
 * the card the owner dropped in front of is, which is why the drag reports a
 * neighbour rather than a number. `null` means the end of the column.
 */
export function resolveIndex(
  tasks: Task[],
  taskId: string,
  column: TaskColumn,
  beforeId: string | null,
): number {
  const rest = tasksIn(tasks, column).filter((t) => t.id !== taskId);
  if (!beforeId) return rest.length;
  const at = rest.findIndex((t) => t.id === beforeId);
  return at === -1 ? rest.length : at;
}

/** "Moved to In progress, position 2 of 5" — what a keyboard move announces. */
export function moveAnnouncement(
  column: TaskColumn,
  index: number,
  total: number,
): string {
  return `${COLUMN_LABEL[column]}, position ${index + 1} of ${total}`;
}
