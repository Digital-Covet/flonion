import { Menu } from "@ark-ui/solid/menu";
import {
  IconAlertTriangle,
  IconAlignLeft,
  IconCheck,
  IconChevronDown,
  IconDots,
  IconExternalLink,
  IconLock,
  IconPlus,
  IconTrash,
} from "@tabler/icons-solidjs";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { focusRing } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { Spinner } from "~/components/onboarding/ui";
import {
  COLUMN_LABEL,
  COLUMNS,
  type GroupTone,
  groupSpan,
  statusMix,
  type Task,
  type TaskColumn,
  type TaskGroup,
  taskCountLabel,
  timelineOf,
} from "~/components/tasks/data";
import {
  AssigneeMark,
  COLUMN_ICON,
  PriorityChip,
} from "~/components/tasks/widgets";
import { cn } from "~/lib/cn";

/**
 * Main table (the owner's "overview of tasks"): tasks grouped into coloured
 * sections, one row each with a timeline bar, assignee, status and priority,
 * and an "Add task" row closing every group.
 *
 * On phones the same groups become stacked cards — a six-column table forced
 * onto a phone hides the status control behind a sideways scroll (spec §1
 * anti-pattern 5).
 */

// ─── Tones ───────────────────────────────────────────────────────────────

const RAIL: Record<GroupTone, string> = {
  error: "bg-error",
  primary: "bg-primary",
  info: "bg-info",
  accent: "bg-accent",
  secondary: "bg-secondary",
  success: "bg-success",
  muted: "bg-text-muted",
};

/** Text on a filled rail: every pairing is a verified token pair (spec §2). */
const ON_RAIL: Record<GroupTone, string> = {
  error: "text-surface",
  primary: "text-primary-foreground",
  info: "text-surface",
  accent: "text-surface",
  secondary: "text-secondary-foreground",
  success: "text-surface",
  muted: "text-surface",
};

const STATUS_FILL: Record<TaskColumn, string> = {
  todo: "bg-info text-surface",
  in_progress: "bg-accent text-surface",
  waiting: "bg-primary text-primary-foreground",
  done: "bg-success text-surface",
};

const STATUS_BAR: Record<TaskColumn, string> = {
  todo: "bg-info",
  in_progress: "bg-accent",
  waiting: "bg-primary",
  done: "bg-success",
};

const menuContent =
  "min-w-44 rounded-md border border-border bg-surface p-1 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

const menuItem =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm text-text outline-none data-[highlighted]:bg-primary-soft data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

// ─── Cells ───────────────────────────────────────────────────────────────

/** A filled status label: icon + word, so the colour is never alone. */
function StatusLabel(props: { column: TaskColumn; class?: string }) {
  const Icon = () => {
    const I = COLUMN_ICON[props.column];
    return <I aria-hidden="true" class="size-3.5 shrink-0" />;
  };
  return (
    <span
      class={cn(
        "inline-flex w-full items-center justify-center gap-1.5 rounded-sm px-2 text-sm font-medium",
        STATUS_FILL[props.column],
        props.class,
      )}
    >
      <Icon />
      <span class="truncate">{COLUMN_LABEL[props.column]}</span>
    </span>
  );
}

/**
 * The status cell. For anyone allowed to edit the task it is a menu: picking
 * a status moves the task, exactly as dragging it across the board would.
 */
function StatusCell(props: {
  task: Task;
  editable: boolean;
  size: "row" | "card";
  onStatus: (task: Task, column: TaskColumn) => void;
}) {
  const height = () => (props.size === "row" ? "h-9" : "h-11");

  return (
    <Show
      when={props.editable}
      fallback={<StatusLabel column={props.task.column} class={height()} />}
    >
      <Menu.Root positioning={{ placement: "bottom", gutter: 4 }}>
        <Menu.Trigger
          aria-label={`Status: ${COLUMN_LABEL[props.task.column]}. Change status of ${props.task.title}`}
          class={cn(
            "group block w-full rounded-sm transition-[filter] duration-[var(--duration-fast)] hover:brightness-110",
            focusRing,
          )}
        >
          <StatusLabel column={props.task.column} class={height()} />
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner class="z-50!">
            <Menu.Content class={menuContent}>
              <Menu.RadioItemGroup
                value={props.task.column}
                onValueChange={(e) =>
                  props.onStatus(props.task, e.value as TaskColumn)
                }
              >
                <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                  Status
                </Menu.ItemGroupLabel>
                <For each={COLUMNS}>
                  {(column) => {
                    const I = COLUMN_ICON[column.value];
                    return (
                      <Menu.RadioItem value={column.value} class={menuItem}>
                        <span
                          aria-hidden="true"
                          class={cn(
                            "grid size-5 place-items-center rounded-sm",
                            STATUS_FILL[column.value],
                          )}
                        >
                          <I class="size-3.5" />
                        </span>
                        <Menu.ItemText class="flex-1">
                          {column.label}
                        </Menu.ItemText>
                        <Menu.ItemIndicator class="text-primary">
                          <IconCheck aria-hidden="true" class="size-4" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    );
                  }}
                </For>
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Show>
  );
}

/**
 * Created → due, filled by how much of that window has passed. The dates are
 * the label; the fill and the words in the screen-reader text say the rest.
 */
function TimelineBar(props: { task: Task; now: Date; size: "row" | "card" }) {
  const t = () => timelineOf(props.task, props.now);
  const fill = () =>
    t().state === "late"
      ? "bg-error/25"
      : t().state === "done"
        ? "bg-success/25"
        : "bg-primary/30";

  return (
    <Show
      when={t().label}
      fallback={
        <span
          class={cn(
            "flex items-center justify-center rounded-sm border border-dashed border-border text-sm text-text-muted",
            props.size === "row" ? "h-9" : "h-11",
          )}
        >
          <span aria-hidden="true">—</span>
          <span class="sr-only">No due date</span>
        </span>
      }
    >
      {(label) => (
        <span
          class={cn(
            "relative block overflow-hidden rounded-sm bg-primary-soft",
            props.size === "row" ? "h-9" : "h-11",
          )}
        >
          <span
            aria-hidden="true"
            class={cn(
              "absolute inset-0 origin-left transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none",
              fill(),
            )}
            style={{ transform: `scaleX(${t().progress})` }}
          />
          <span class="relative flex h-full items-center justify-center gap-1 px-2 font-mono text-xs font-medium tabular-nums whitespace-nowrap text-text">
            <Show when={t().state === "late"}>
              <IconAlertTriangle
                aria-hidden="true"
                class="size-3.5 shrink-0 text-error"
              />
            </Show>
            {label()}
            <span class="sr-only">
              {t().state === "late"
                ? ", overdue"
                : t().state === "done"
                  ? ", finished"
                  : `, ${Math.round(t().progress * 100)}% of the time used`}
            </span>
          </span>
        </span>
      )}
    </Show>
  );
}

function RowMenu(props: {
  task: Task;
  editable: boolean;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 4 }}
      onSelect={(details) => {
        if (details.value === "open") props.onOpen(props.task);
        if (details.value === "delete") props.onDelete(props.task);
      }}
    >
      <Menu.Trigger
        aria-label={`More actions for ${props.task.title}`}
        class={cn(
          "grid size-9 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text data-[state=open]:bg-primary-soft",
          focusRing,
        )}
      >
        <IconDots aria-hidden="true" class="size-4" />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={menuContent}>
            <Menu.Item value="open" class={menuItem}>
              <IconExternalLink
                aria-hidden="true"
                class="size-4 text-text-muted"
              />
              {props.editable ? "Open and edit" : "Open"}
            </Menu.Item>
            <Show when={props.editable}>
              <Menu.Separator class="my-1 h-px border-0 bg-border" />
              <Menu.Item value="delete" class={cn(menuItem, "text-error")}>
                <IconTrash aria-hidden="true" class="size-4" />
                Delete
              </Menu.Item>
            </Show>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/** The task's name, with the small marks an owner scans for. */
function TitleCell(props: {
  task: Task;
  editable: boolean;
  onOpen: (task: Task) => void;
}) {
  return (
    <span class="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => props.onOpen(props.task)}
        class={cn(
          "min-w-0 truncate rounded-sm text-left font-medium text-text hover:text-primary",
          "transition-colors duration-[var(--duration-fast)]",
          props.task.column === "done" && "text-text-muted line-through",
          focusRing,
        )}
      >
        {props.task.title}
        <Show when={props.task.column === "done"}>
          <span class="sr-only"> (done)</span>
        </Show>
      </button>
      <Show when={props.task.description}>
        <span title="Has details" class="shrink-0 text-text-muted">
          <IconAlignLeft aria-hidden="true" class="size-4" />
          <span class="sr-only">Has details</span>
        </span>
      </Show>
      <Show when={!props.editable}>
        <span
          title="Only the assignee, an admin, or the owner can change this task"
          class="shrink-0 text-text-muted"
        >
          <IconLock aria-hidden="true" class="size-4" />
          <span class="sr-only">Locked — assigned to someone else</span>
        </span>
      </Show>
    </span>
  );
}

function Assignee(props: { task: Task }) {
  const name = () => props.task.assignee?.name ?? "Unassigned";
  return (
    <span class="flex items-center justify-center" title={name()}>
      <AssigneeMark member={props.task.assignee} class="size-8" />
      <span class="sr-only">{name()}</span>
    </span>
  );
}

/** Up to three faces, then "+n" — who is working in this group. */
function AssigneeStack(props: { tasks: Task[] }) {
  const people = () => {
    const seen = new Map<string, NonNullable<Task["assignee"]>>();
    for (const t of props.tasks) {
      if (t.assignee && !seen.has(t.assignee.id)) {
        seen.set(t.assignee.id, t.assignee);
      }
    }
    return [...seen.values()];
  };
  return (
    <span class="flex items-center justify-center">
      <span class="sr-only">
        {people()
          .map((p) => p.name)
          .join(", ")}
      </span>
      <span aria-hidden="true" class="flex -space-x-2">
        <For each={people().slice(0, 3)}>
          {(p) => (
            <AssigneeMark member={p} class="size-7 ring-2 ring-surface" />
          )}
        </For>
        <Show when={people().length > 3}>
          <span class="grid size-7 place-items-center rounded-full bg-background font-mono text-xs text-text-muted ring-2 ring-surface">
            +{people().length - 3}
          </span>
        </Show>
      </span>
    </span>
  );
}

/** Status share across the group, drawn once and spelled out for listeners. */
function StatusMix(props: { tasks: Task[] }) {
  const mix = () => statusMix(props.tasks);
  const words = () =>
    mix()
      .map((m) => `${m.count} ${COLUMN_LABEL[m.column].toLowerCase()}`)
      .join(", ");
  return (
    <Show when={mix().length > 0}>
      <span class="block" title={words()}>
        <span class="sr-only">{words()}</span>
        <span
          aria-hidden="true"
          class="flex h-9 overflow-hidden rounded-sm bg-background"
        >
          <For each={mix()}>
            {(m) => (
              <span
                class={STATUS_BAR[m.column]}
                style={{ "flex-grow": m.count }}
              />
            )}
          </For>
        </span>
      </span>
    </Show>
  );
}

// ─── Adding ──────────────────────────────────────────────────────────────

/**
 * "Add task" turns into a text field in place; Enter adds and keeps the field
 * open for the next one, Escape closes it. Anything else about the task can be
 * set by opening it afterwards.
 */
function QuickAdd(props: {
  group: string;
  onAdd: (title: string) => Promise<boolean>;
}) {
  const [open, setOpen] = createSignal(false);
  const [value, setValue] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let input: HTMLInputElement | undefined;

  async function submit() {
    const title = value().trim();
    if (!title || busy()) return;
    setBusy(true);
    const ok = await props.onAdd(title);
    setBusy(false);
    if (ok) setValue("");
    queueMicrotask(() => input?.focus());
  }

  return (
    <Show
      when={open()}
      fallback={
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            queueMicrotask(() => input?.focus());
          }}
          class={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-sm px-1 text-sm font-medium text-text-muted hover:text-primary",
            "transition-colors duration-[var(--duration-fast)]",
            focusRing,
          )}
        >
          <IconPlus aria-hidden="true" class="size-4" />
          Add task
          <span class="sr-only"> to {props.group}</span>
        </button>
      }
    >
      <form
        class="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={input}
          type="text"
          maxlength={160}
          value={value()}
          disabled={busy()}
          placeholder="Task name, then Enter"
          aria-label={`New task in ${props.group}`}
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setValue("");
              setOpen(false);
            }
          }}
          onBlur={() => {
            if (!value().trim() && !busy()) setOpen(false);
          }}
          class="h-9 min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-2.5 text-base text-text placeholder:text-text-muted/80 focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary md:text-sm"
        />
        <Show when={busy()}>
          <Spinner class="size-4 text-text-muted" />
        </Show>
      </form>
    </Show>
  );
}

// ─── Groups ──────────────────────────────────────────────────────────────

type TableProps = {
  groups: TaskGroup[];
  now: Date;
  movingId: string | null;
  canCreate: boolean;
  canEdit: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, column: TaskColumn) => void;
  onDelete: (task: Task) => void;
  onQuickAdd: (group: TaskGroup, title: string) => Promise<boolean>;
};

function GroupToggle(props: {
  group: TaskGroup;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={props.open}
      aria-controls={props.controls}
      onClick={() => props.onToggle()}
      class={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-sm text-left",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        class={cn(
          "grid size-9 shrink-0 place-items-center rounded-md",
          RAIL[props.group.tone],
          ON_RAIL[props.group.tone],
        )}
      >
        <IconChevronDown
          class={cn(
            "size-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none",
            !props.open && "-rotate-90",
          )}
        />
      </span>
      <span class="truncate font-display text-base font-semibold text-text">
        {props.group.label}
      </span>
      <span class="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs tabular-nums text-primary">
        {props.group.tasks.length}
        <span class="sr-only"> {taskCountLabel(props.group.tasks.length)}</span>
      </span>
    </button>
  );
}

const th =
  "px-3 py-2 text-center text-sm font-medium whitespace-nowrap text-text-muted";

function GroupTable(props: {
  group: TaskGroup;
  open: boolean;
  onToggle: () => void;
  table: TableProps;
}) {
  const bodyId = createUniqueId();
  const g = () => props.group;
  const open = () => props.open;

  return (
    <section
      aria-label={`${g().label}, ${g().tasks.length} ${taskCountLabel(g().tasks.length)}`}
      class="overflow-hidden rounded-lg border border-border bg-surface"
    >
      {/* ── Desktop: a real table, header in the group's own bar ── */}
      <div class="hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] table-fixed border-collapse">
            <caption class="sr-only">
              {g().label} — {g().tasks.length}{" "}
              {taskCountLabel(g().tasks.length)}
            </caption>
            <colgroup>
              <col />
              <col class="w-48" />
              <col class="w-24" />
              <col class="w-40" />
              <col class="hidden w-32 lg:table-column" />
              <col class="w-14" />
            </colgroup>
            <thead>
              <tr class="border-b border-border bg-background/60">
                <th scope="col" class="px-3 py-1 text-left">
                  <GroupToggle
                    group={g()}
                    open={open()}
                    controls={bodyId}
                    onToggle={props.onToggle}
                  />
                  <span class="sr-only">Task</span>
                </th>
                <th scope="col" class={th}>
                  Timeline
                </th>
                <th scope="col" class={th}>
                  Assignee
                </th>
                <th scope="col" class={th}>
                  Status
                </th>
                <th scope="col" class={cn(th, "hidden lg:table-cell")}>
                  Priority
                </th>
                <th scope="col" class={th}>
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody id={bodyId} hidden={!open()}>
              <For each={g().tasks}>
                {(task) => {
                  const editable = () => props.table.canEdit(task);
                  return (
                    <tr
                      class={cn(
                        "border-b border-border transition-colors duration-[var(--duration-fast)] hover:bg-background/60",
                        props.table.movingId === task.id && "opacity-60",
                      )}
                    >
                      <td class="relative py-1.5 pr-3 pl-5">
                        <span
                          aria-hidden="true"
                          class={cn(
                            "absolute inset-y-0 left-0 w-1.5",
                            RAIL[g().tone],
                          )}
                        />
                        <TitleCell
                          task={task}
                          editable={editable()}
                          onOpen={props.table.onOpen}
                        />
                      </td>
                      <td class="px-3 py-1.5">
                        <TimelineBar
                          task={task}
                          now={props.table.now}
                          size="row"
                        />
                      </td>
                      <td class="px-3 py-1.5">
                        <Assignee task={task} />
                      </td>
                      <td class="px-3 py-1.5">
                        <StatusCell
                          task={task}
                          editable={editable()}
                          size="row"
                          onStatus={props.table.onStatus}
                        />
                      </td>
                      <td class="hidden px-3 py-1.5 text-center lg:table-cell">
                        <PriorityChip priority={task.priority} />
                      </td>
                      <td class="px-2 py-1.5 text-center">
                        <RowMenu
                          task={task}
                          editable={editable()}
                          onOpen={props.table.onOpen}
                          onDelete={props.table.onDelete}
                        />
                      </td>
                    </tr>
                  );
                }}
              </For>

              {/* Closing row: add a task here, and the group at a glance. */}
              <tr class="bg-background/40">
                <td class="py-1.5 pr-3 pl-5">
                  <Show
                    when={props.table.canCreate && g().defaults}
                    fallback={
                      <span class="text-sm text-text-muted">
                        <Show when={g().tasks.length === 0}>Nothing here.</Show>
                      </span>
                    }
                  >
                    <QuickAdd
                      group={g().label}
                      onAdd={(title) => props.table.onQuickAdd(g(), title)}
                    />
                  </Show>
                </td>
                <td class="px-3 py-1.5">
                  <Show when={groupSpan(g().tasks)}>
                    {(span) => (
                      <span class="flex h-9 items-center justify-center rounded-sm bg-primary-soft font-mono text-xs font-medium tabular-nums text-primary">
                        <span class="sr-only">Group runs </span>
                        {span()}
                      </span>
                    )}
                  </Show>
                </td>
                <td class="px-3 py-1.5">
                  <AssigneeStack tasks={g().tasks} />
                </td>
                <td class="px-3 py-1.5">
                  <StatusMix tasks={g().tasks} />
                </td>
                <td class="hidden lg:table-cell" />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Phones: the same group as stacked cards ── */}
      <div class="md:hidden">
        <div class="flex items-center justify-between gap-2 border-b border-border bg-background/60 px-3 py-1">
          <GroupToggle
            group={g()}
            open={open()}
            controls={`${bodyId}-cards`}
            onToggle={props.onToggle}
          />
        </div>
        <div id={`${bodyId}-cards`} hidden={!open()}>
          <ul class="flex flex-col">
            <For each={g().tasks}>
              {(task) => {
                const editable = () => props.table.canEdit(task);
                return (
                  <li
                    class={cn(
                      "relative flex flex-col gap-3 border-b border-border py-3 pr-3 pl-5",
                      props.table.movingId === task.id && "opacity-60",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      class={cn(
                        "absolute inset-y-0 left-0 w-1.5",
                        RAIL[g().tone],
                      )}
                    />
                    <div class="flex items-start gap-2">
                      <div class="min-w-0 flex-1 pt-2">
                        <TitleCell
                          task={task}
                          editable={editable()}
                          onOpen={props.table.onOpen}
                        />
                      </div>
                      <AssigneeMark
                        member={task.assignee}
                        class="mt-1 size-9"
                      />
                      <RowMenu
                        task={task}
                        editable={editable()}
                        onOpen={props.table.onOpen}
                        onDelete={props.table.onDelete}
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <StatusCell
                        task={task}
                        editable={editable()}
                        size="card"
                        onStatus={props.table.onStatus}
                      />
                      <TimelineBar
                        task={task}
                        now={props.table.now}
                        size="card"
                      />
                    </div>
                    <div>
                      <PriorityChip priority={task.priority} />
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>
          <Show when={props.table.canCreate && g().defaults}>
            <div class="px-4 py-2">
              <QuickAdd
                group={g().label}
                onAdd={(title) => props.table.onQuickAdd(g(), title)}
              />
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}

export function TaskTable(props: TableProps) {
  /** Collapsed group keys: survive re-grouping, refetches and edits. */
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  function toggle(key: string) {
    setCollapsed((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Groups are rebuilt from the task list on every change. Keying the loop
  // on their string keys (not the objects) keeps each group's DOM — and the
  // "Add task" field someone is typing into — alive across those rebuilds.
  const keys = () => props.groups.map((g) => g.key);

  return (
    <div class="flex flex-col gap-5">
      <For each={keys()}>
        {(key) => {
          const group = () => props.groups.find((g) => g.key === key);
          return (
            <Show when={group()}>
              {(g) => (
                <GroupTable
                  group={g()}
                  open={!collapsed().has(key)}
                  onToggle={() => toggle(key)}
                  table={props}
                />
              )}
            </Show>
          );
        }}
      </For>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-5">
      <span class="sr-only">Loading your tasks…</span>
      <For each={[4, 3]}>
        {(rows) => (
          <div class="overflow-hidden rounded-lg border border-border bg-surface">
            <div class="flex items-center gap-3 border-b border-border bg-background/60 px-3 py-2">
              <Skeleton class="size-9 rounded-md" />
              <Skeleton class="h-5 w-32" />
            </div>
            <For each={Array.from({ length: rows })}>
              {() => (
                <div class="flex items-center gap-4 border-b border-border px-5 py-2.5">
                  <Skeleton class="h-4 flex-1" />
                  <Skeleton class="hidden h-8 w-44 md:block" />
                  <Skeleton class="size-8 rounded-full" />
                  <Skeleton class="hidden h-8 w-36 md:block" />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
