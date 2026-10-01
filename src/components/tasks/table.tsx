import { Collapsible } from "@ark-ui/solid/collapsible";
import { DatePicker } from "@ark-ui/solid/date-picker";
import { Editable } from "@ark-ui/solid/editable";
import { Field } from "@ark-ui/solid/field";
import { Menu } from "@ark-ui/solid/menu";
import { Progress } from "@ark-ui/solid/progress";
import { createListCollection, Select } from "@ark-ui/solid/select";
import {
  IconAlertTriangle,
  IconAlignLeft,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsSort,
  IconArrowUp,
  IconCalendar,
  IconCalendarDue,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumns3,
  IconCopy,
  IconCornerDownRight,
  IconDots,
  IconEraser,
  IconExternalLink,
  IconEyeOff,
  IconHash,
  IconLink,
  IconPencil,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  IconSquareCheck,
  IconTag,
  IconTextCaption,
  IconTransform,
  IconTrash,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onMount,
  Show,
  Switch,
  useContext,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import type { TeamMember } from "~/components/app/context";
import { focusRing } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { Spinner } from "~/components/onboarding/ui";
import {
  assigneesOf,
  COLUMN_LABEL,
  COLUMNS,
  type ColumnSort,
  type CustomColumn,
  customSortKey,
  DEFAULT_HEADINGS,
  dueDayKey,
  type FieldPlacement,
  type FieldValues,
  fieldInputText,
  type GroupTone,
  type HeadingKey,
  PRIORITY_OPTIONS,
  richTextLines,
  type SortDir,
  type Task,
  type TaskColumn,
  type TaskDraft,
  type TaskGroup,
  taskCountLabel,
  timelineOf,
} from "~/components/tasks/data";
import {
  AssigneeStack,
  COLUMN_ICON,
  DatePickerCalendar,
  LockHint,
  PriorityChip,
  parseDayValue,
} from "~/components/tasks/widgets";
import { cn } from "~/lib/cn";
import {
  FIELD_TYPES,
  type FieldType,
  type FieldValue,
  fieldTypeLabel,
  MAX_FIELD_COLUMNS,
  parseFieldInput,
  safeHref,
} from "~/lib/task-fields";

/**
 * Main table (the owner's "overview of tasks"). The component tree:
 *
 *   TaskTable
 *   ├─ TableHeader        column headings, one per group
 *   ├─ TaskGroupTable     a coloured section
 *   │  ├─ TaskItem        HierarchyToggle, TaskTitle, TaskMetadata, and the
 *   │  │                  Status / Date / Assignee / Description cells
 *   │  └─ SubtaskList     SubtaskItem rows (HierarchyIndicator + the same
 *   │                     cells) closed by an AddSubtaskAction
 *   └─ TableActions       AddColumnAction: show the optional columns
 *
 * On phones the same groups become stacked cards — a seven-column table forced
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

// ─── Inline editing ──────────────────────────────────────────────────────

/** The fields a cell can change in place (status has its own menu). */
export type TaskPatch = Partial<
  Pick<
    TaskDraft,
    "title" | "description" | "dueDate" | "assigneeIds" | "priority"
  >
>;

type EditApi = {
  members: TeamMember[];
  /** Resolves true when the change was saved. */
  onEdit: (task: Task, patch: TaskPatch) => Promise<boolean>;
};

const EditContext = createContext<EditApi>();

const editorInput =
  "h-9 w-full min-w-0 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary disabled:opacity-60";

type EditorProps = {
  label: string;
  busy: boolean;
  onCommit: (patch: TaskPatch) => void;
  onCancel: () => void;
};

/**
 * Double-click (or F2) wrapper for non-text cells whose editors are Ark
 * Select / Field controls. Text cells use Ark Editable directly below.
 */
function DblClickEdit(props: {
  task: Task;
  editable: boolean;
  editor: (editor: EditorProps) => JSX.Element;
  label: string;
  children: (start: () => void) => JSX.Element;
}) {
  const api = useContext(EditContext);
  const [editing, setEditing] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const start = () => {
    if (props.editable && api) setEditing(true);
  };

  async function commit(patch: TaskPatch) {
    if (busy() || !api) return;
    setBusy(true);
    await api.onEdit(props.task, patch);
    setBusy(false);
    setEditing(false);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; the keyboard path is F2 on the focusable text and "Open and edit" in the row menu
    <div
      class="min-w-0"
      title={props.editable ? "Double-click to edit" : undefined}
      onDblClick={start}
      onKeyDown={(e) => {
        if (e.key === "F2" && !editing()) {
          e.preventDefault();
          start();
        }
      }}
    >
      <Show when={editing()} fallback={props.children(start)}>
        {props.editor({
          label: props.label,
          busy: busy(),
          onCommit: (patch) => void commit(patch),
          onCancel: () => setEditing(false),
        })}
      </Show>
    </div>
  );
}

/**
 * Title / description inline edit backed by Ark Editable: dbl-click to edit,
 * Enter or blur commits, Escape cancels. Commits through EditContext.
 */
function InlineText(props: {
  task: Task;
  field: "title" | "description";
  value: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  previewClass: string;
}) {
  const api = useContext(EditContext);
  const [busy, setBusy] = createSignal(false);
  // Controlled editor: the text being typed must live here too, or every
  // keystroke is reset to the saved value and the commit sees no change.
  const [draft, setDraft] = createSignal(props.value);
  createEffect(() => setDraft(props.value));

  async function commit(details: { value: string }) {
    if (busy() || !api) return;
    const next = details.value.trim();
    if (next === props.value.trim() || (props.required && !next)) return;
    setBusy(true);
    await api.onEdit(props.task, { [props.field]: next } as TaskPatch);
    setBusy(false);
  }

  return (
    <Editable.Root
      value={draft()}
      onValueChange={(details: { value: string }) => setDraft(details.value)}
      placeholder={props.placeholder ?? "—"}
      activationMode="dblclick"
      submitMode="both"
      selectOnFocus
      maxLength={props.maxLength}
      disabled={busy()}
      onValueCommit={(details: { value: string }) => void commit(details)}
      class="min-w-0"
    >
      <Editable.Label class="sr-only">{props.label}</Editable.Label>
      <Editable.Area class="min-w-0">
        <Editable.Preview class={props.previewClass} />
        <Editable.Input class={editorInput} />
      </Editable.Area>
    </Editable.Root>
  );
}

/**
 * Assignees editor: a list to tick, saved when it closes. Anyone already on
 * the task keeps their place, so the lead stays the lead; new people join at
 * the end. A task always keeps at least one assignee.
 */
function AssigneesEditor(
  props: EditorProps & {
    value: string[];
    options: ReadonlyArray<{ value: string; label: string }>;
  },
) {
  const collection = createMemo(() =>
    createListCollection({ items: [...props.options] }),
  );
  const [picked, setPicked] = createSignal<string[]>(props.value);
  let trigger: HTMLButtonElement | undefined;
  let done = false;
  onMount(() => trigger?.focus());

  function finish() {
    if (done || props.busy) return;
    done = true;
    const chosen = picked();
    const ordered = [
      ...props.value.filter((id) => chosen.includes(id)),
      ...chosen.filter((id) => !props.value.includes(id)),
    ];
    const unchanged =
      ordered.length === props.value.length &&
      ordered.every((id, i) => id === props.value[i]);
    if (ordered.length === 0 || unchanged) props.onCancel();
    else props.onCommit({ assigneeIds: ordered });
  }

  return (
    <Select.Root
      multiple
      closeOnSelect={false}
      defaultOpen
      collection={collection()}
      value={picked()}
      disabled={props.busy}
      positioning={{ placement: "bottom-start", gutter: 4 }}
      onValueChange={(e) => setPicked(e.value)}
      onOpenChange={(e) => {
        if (!e.open) finish();
      }}
      class="min-w-0"
    >
      <Select.Control>
        <Select.Trigger
          ref={trigger}
          aria-label={props.label}
          class={cn(editorInput, "flex items-center justify-between gap-2")}
        >
          <Select.ValueText class="truncate" placeholder="Choose people" />
          <Select.Indicator class="shrink-0 text-text-muted">
            <IconChevronDown aria-hidden="true" class="size-4" />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner class="z-50!">
          <Select.Content class={cn(menuContent, "min-w-56")}>
            <For each={collection().items}>
              {(item) => (
                <Select.Item item={item} class={menuItem}>
                  <Select.ItemText class="flex-1">{item.label}</Select.ItemText>
                  <Select.ItemIndicator class="text-primary">
                    <IconCheck aria-hidden="true" class="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              )}
            </For>
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

/** Priority editor backed by Ark Select. Choosing saves. */
function SelectEditor(
  props: EditorProps & {
    value: string;
    field: "priority";
    options: ReadonlyArray<{ value: string; label: string }>;
  },
) {
  const collection = createMemo(() =>
    createListCollection({ items: [...props.options] }),
  );
  let trigger: HTMLButtonElement | undefined;
  onMount(() => trigger?.focus());

  function commit(next: string | undefined) {
    if (!next || next === props.value) {
      props.onCancel();
      return;
    }
    props.onCommit({ [props.field]: next } as TaskPatch);
  }

  return (
    <Select.Root
      collection={collection()}
      value={props.value ? [props.value] : []}
      disabled={props.busy}
      positioning={{ placement: "bottom-start", gutter: 4 }}
      onValueChange={(e) => commit(e.value[0])}
      onOpenChange={(e) => {
        if (!e.open && !props.busy) props.onCancel();
      }}
      class="min-w-0"
    >
      <Select.Control>
        <Select.Trigger
          ref={trigger}
          aria-label={props.label}
          class={cn(editorInput, "flex items-center justify-between gap-2")}
        >
          <Select.ValueText class="truncate" />
          <Select.Indicator class="shrink-0 text-text-muted">
            <IconChevronDown aria-hidden="true" class="size-4" />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner class="z-50!">
          <Select.Content class={menuContent}>
            <For each={collection().items}>
              {(item) => (
                <Select.Item item={item} class={menuItem}>
                  <Select.ItemText class="flex-1">{item.label}</Select.ItemText>
                  <Select.ItemIndicator class="text-primary">
                    <IconCheck aria-hidden="true" class="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              )}
            </For>
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

/** Due-date editor backed by Ark DatePicker: typed input plus calendar. */
function DateEditor(props: EditorProps & { value: string }) {
  let input: HTMLInputElement | undefined;
  onMount(() => input?.focus());
  let done = false;

  function commit(next: string) {
    if (done) return;
    done = true;
    if (next === props.value) props.onCancel();
    else props.onCommit({ dueDate: next });
  }

  return (
    <DatePicker.Root
      value={parseDayValue(props.value)}
      disabled={props.busy}
      positioning={{ placement: "bottom-start", gutter: 4 }}
      onValueChange={(e) => commit(e.value[0]?.toString() ?? "")}
      onOpenChange={(e) => {
        if (!e.open && !done && !props.busy) {
          done = true;
          props.onCancel();
        }
      }}
      class="min-w-0"
    >
      <DatePicker.Label class="sr-only">{props.label}</DatePicker.Label>
      <DatePicker.Control class="flex items-center gap-1.5">
        <DatePicker.Input
          ref={input}
          placeholder="YYYY-MM-DD"
          class={cn(editorInput, "min-w-0 flex-1")}
        />
        <DatePicker.Trigger
          aria-label="Choose date"
          class="grid size-9 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-primary"
        >
          <IconCalendarDue aria-hidden="true" class="size-4" />
        </DatePicker.Trigger>
      </DatePicker.Control>
      <Portal>
        <DatePicker.Positioner class="z-50!">
          <DatePicker.Content class="rounded-md border border-border bg-surface p-3 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)]">
            <DatePickerCalendar />
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}

/**
 * Created → due, filled by how much of that window has passed. The dates are
 * the label; the fill and the words in the screen-reader text say the rest.
 */
function DateCell(props: {
  task: Task;
  now: Date;
  size: "row" | "card";
  editable: boolean;
}) {
  return (
    <DblClickEdit
      task={props.task}
      editable={props.editable}
      label={`Due date of ${props.task.title}`}
      editor={(e) => <DateEditor {...e} value={dueDayKey(props.task) ?? ""} />}
    >
      {() => (
        <DateDisplay task={props.task} now={props.now} size={props.size} />
      )}
    </DblClickEdit>
  );
}

function DateDisplay(props: { task: Task; now: Date; size: "row" | "card" }) {
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
        <Progress.Root
          value={Math.round(t().progress * 100)}
          aria-label={`${props.task.title}: ${label()}${t().state === "late" ? ", overdue" : t().state === "done" ? ", finished" : `, ${Math.round(t().progress * 100)}% of the time used`}`}
          class={cn(
            "relative block overflow-hidden rounded-sm bg-primary-soft",
            props.size === "row" ? "h-9" : "h-11",
          )}
        >
          <Progress.Track class="absolute inset-0">
            <Progress.Range
              class={cn(
                "h-full origin-left transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none",
                fill(),
              )}
            />
          </Progress.Track>
          <span class="relative flex h-full items-center justify-center gap-1 px-2 font-mono text-xs font-medium tabular-nums whitespace-nowrap text-text">
            <Show when={t().state === "late"}>
              <IconAlertTriangle
                aria-hidden="true"
                class="size-3.5 shrink-0 text-error"
              />
            </Show>
            {label()}
            <Progress.ValueText class="sr-only">
              {t().state === "late"
                ? ", overdue"
                : t().state === "done"
                  ? ", finished"
                  : `, ${Math.round(t().progress * 100)}% of the time used`}
            </Progress.ValueText>
          </span>
        </Progress.Root>
      )}
    </Show>
  );
}

function RowMenu(props: {
  task: Task;
  editable: boolean;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
  table?: TableState;
}) {
  const moveTargets = () =>
    props.table?.isCustom
      ? (props.table.groups.filter(
          (g) => g.customSectionId !== undefined,
        ) as TaskGroup[])
      : [];
  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 4 }}
      onSelect={(details) => {
        if (details.value === "open") props.onOpen(props.task);
        if (details.value === "delete") props.onDelete(props.task);
        if (details.value.startsWith("move:")) {
          const key = details.value.slice("move:".length);
          const target = moveTargets().find((g) => g.key === key);
          if (target && props.table?.onMoveToSection) {
            props.table.onMoveToSection(
              props.task,
              target.customSectionId ?? null,
            );
          }
        }
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
            <Show
              when={moveTargets().length > 1 && props.table?.onMoveToSection}
            >
              <Menu.Separator class="my-1 h-px border-0 bg-border" />
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                  Move to section
                </Menu.ItemGroupLabel>
                <For each={moveTargets()}>
                  {(target) => (
                    <Menu.Item value={`move:${target.key}`} class={menuItem}>
                      <Menu.ItemText class="flex-1 truncate">
                        {target.label}
                      </Menu.ItemText>
                    </Menu.Item>
                  )}
                </For>
              </Menu.ItemGroup>
            </Show>
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
function TaskTitle(props: {
  task: Task;
  editable: boolean;
  onOpen: (task: Task) => void;
}) {
  const previewClass = () =>
    cn(
      "block max-w-full min-w-0 truncate rounded-sm text-left font-medium text-text hover:text-primary",
      "transition-colors duration-[var(--duration-fast)]",
      props.task.column === "done" && "text-text-muted line-through",
      focusRing,
    );
  return (
    <span class="flex min-w-0 flex-1 items-center gap-2">
      <Show
        when={props.editable}
        fallback={
          <button
            type="button"
            onClick={() => props.onOpen(props.task)}
            class={previewClass()}
          >
            {props.task.title}
            <Show when={props.task.column === "done"}>
              <span class="sr-only"> (done)</span>
            </Show>
          </button>
        }
      >
        <span class="min-w-0 flex-1" title="Double-click to edit">
          <InlineText
            task={props.task}
            field="title"
            value={props.task.title}
            label={`Title of ${props.task.title}`}
            required
            maxLength={160}
            previewClass={previewClass()}
          />
        </span>
        <Show when={props.task.column === "done"}>
          <span class="sr-only"> (done)</span>
        </Show>
      </Show>
      <Show when={!props.editable}>
        <span class="shrink-0 text-text-muted">
          <LockHint class="size-5" />
        </span>
      </Show>
    </span>
  );
}

/**
 * The task's details, two lines at most. It opens the task like the title
 * does, so the full text — and editing it — is one click away.
 */
function DescriptionCell(props: {
  task: Task;
  editable: boolean;
  onOpen: (task: Task) => void;
  lines?: 1 | 2;
}) {
  const previewClass = () =>
    cn(
      "w-full rounded-sm text-left text-sm text-pretty text-text-muted hover:text-text",
      "transition-colors duration-[var(--duration-fast)]",
      props.lines === 1 ? "line-clamp-1" : "line-clamp-2",
      focusRing,
    );
  return (
    <Show
      when={props.editable}
      fallback={
        <Show
          when={props.task.description?.trim()}
          fallback={
            <button
              type="button"
              onClick={() => props.onOpen(props.task)}
              class={cn(
                "w-full rounded-sm text-left text-sm text-text-muted",
                focusRing,
              )}
            >
              <span aria-hidden="true">—</span>
              <span class="sr-only">No description</span>
            </button>
          }
        >
          {(text) => (
            <button
              type="button"
              title={text()}
              onClick={() => props.onOpen(props.task)}
              class={previewClass()}
            >
              <span class="sr-only">Description: </span>
              {text()}
            </button>
          )}
        </Show>
      }
    >
      <span class="block min-w-0" title="Double-click to edit">
        <InlineText
          task={props.task}
          field="description"
          value={props.task.description ?? ""}
          label={`Description of ${props.task.title}`}
          maxLength={2000}
          placeholder="—"
          previewClass={previewClass()}
        />
      </span>
    </Show>
  );
}

function AssigneeCell(props: { task: Task; editable: boolean }) {
  const api = useContext(EditContext);
  return (
    <DblClickEdit
      task={props.task}
      editable={props.editable}
      label={`Assignees of ${props.task.title}`}
      editor={(e) => (
        <AssigneesEditor
          {...e}
          value={assigneesOf(props.task).map((p) => p.id)}
          options={(api?.members ?? []).map((m) => ({
            value: m.id,
            label: m.name,
          }))}
        />
      )}
    >
      {() => (
        <span class="flex items-center justify-center">
          <AssigneeStack
            people={assigneesOf(props.task)}
            max={2}
            class="size-7"
          />
        </span>
      )}
    </DblClickEdit>
  );
}

function PriorityCell(props: { task: Task; editable: boolean }) {
  return (
    <DblClickEdit
      task={props.task}
      editable={props.editable}
      label={`Priority of ${props.task.title}`}
      editor={(e) => (
        <SelectEditor
          {...e}
          field="priority"
          value={props.task.priority}
          options={PRIORITY_OPTIONS}
        />
      )}
    >
      {() => (
        <span class="flex justify-center">
          <PriorityChip priority={props.task.priority} />
        </span>
      )}
    </DblClickEdit>
  );
}

// ─── Added columns ───────────────────────────────────────────────────────

/**
 * Edit-in-place for the cells of added columns. Double-click, Enter on the
 * focused value, or the pencil starts editing; Enter saves (Ctrl/Cmd+Enter in
 * multi-line cells), Escape cancels, and a value that doesn't fit the column
 * stays open with the reason next to it.
 */
function CellEditor(props: {
  label: string;
  /** The text editing starts from. */
  initial: string;
  editable: boolean;
  multiline?: boolean;
  inputType?: "text" | "date";
  inputMode?: "decimal";
  placeholder?: string;
  /** True when the display holds links, which can't live inside a button. */
  linksInside?: boolean;
  /** Returns why the text can't be saved, or null once it was. */
  onCommit: (text: string) => string | null;
  children: JSX.Element;
}) {
  const [editing, setEditing] = createSignal(false);
  const [text, setText] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  let field: HTMLInputElement | HTMLTextAreaElement | undefined;
  let finished = false;

  function start() {
    if (!props.editable || editing()) return;
    finished = false;
    setText(props.initial);
    setError(null);
    setEditing(true);
    queueMicrotask(() => {
      field?.focus();
      if (props.inputType !== "date") field?.select();
    });
  }

  function save() {
    if (finished) return;
    const problem = props.onCommit(text());
    if (problem) {
      setError(problem);
      return;
    }
    finished = true;
    setEditing(false);
  }

  function cancel() {
    finished = true;
    setEditing(false);
  }

  const fieldClass = cn(
    editorInput,
    "text-sm",
    props.multiline && "min-h-20 resize-y py-1.5",
    error() && "border-error",
  );

  return (
    <Show
      when={editing()}
      fallback={
        <div class="group/cell flex min-w-0 items-center gap-1">
          <Show
            when={!props.linksInside}
            fallback={<div class="min-w-0 flex-1">{props.children}</div>}
          >
            <button
              type="button"
              disabled={!props.editable}
              title={props.editable ? "Double-click to edit" : undefined}
              onDblClick={start}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  start();
                }
              }}
              class={cn(
                "min-w-0 flex-1 rounded-sm px-1 py-0.5 text-left text-sm text-text disabled:cursor-default",
                focusRing,
              )}
            >
              {props.children}
            </button>
          </Show>
          <Show when={props.editable}>
            <button
              type="button"
              aria-label={`Edit ${props.label}`}
              title="Edit"
              onClick={start}
              class={cn(CELL_ACTION, "shrink-0", focusRing)}
            >
              <IconPencil aria-hidden="true" class="size-3.5" />
            </button>
          </Show>
        </div>
      }
    >
      <div class="flex min-w-0 flex-col gap-1">
        <Show
          when={props.multiline}
          fallback={
            <input
              ref={(el) => {
                field = el;
              }}
              type={props.inputType ?? "text"}
              inputMode={props.inputMode}
              aria-label={props.label}
              aria-invalid={error() ? "true" : undefined}
              placeholder={props.placeholder}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              class={fieldClass}
            />
          }
        >
          <textarea
            ref={(el) => {
              field = el;
            }}
            rows={3}
            aria-label={props.label}
            aria-invalid={error() ? "true" : undefined}
            placeholder={props.placeholder}
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            class={fieldClass}
          />
          <p class="text-xs text-text-muted">Ctrl+Enter saves, Esc cancels</p>
        </Show>
        <Show when={error()}>
          <p role="alert" class="text-xs text-error">
            {error()}
          </p>
        </Show>
      </div>
    </Show>
  );
}

const EMPTY_VALUE = (
  <>
    <span aria-hidden="true" class="text-text-muted">
      —
    </span>
    <span class="sr-only">Empty</span>
  </>
);

/** Rich text as lines of plain, bold, italic and safe-link pieces. */
function RichText(props: { text: string }) {
  return (
    <div class="line-clamp-3 min-w-0 text-sm break-words text-text">
      <For each={richTextLines(props.text)}>
        {(line) => (
          <p class="min-h-[1lh]">
            <For each={line}>
              {(token) => {
                switch (token.kind) {
                  case "bold":
                    return <strong class="font-semibold">{token.text}</strong>;
                  case "italic":
                    return <em>{token.text}</em>;
                  case "link":
                    return (
                      <a
                        href={token.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={cn("text-primary underline", focusRing)}
                      >
                        {token.text}
                      </a>
                    );
                  default:
                    return token.text;
                }
              }}
            </For>
          </p>
        )}
      </For>
    </div>
  );
}

const shortDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** One value of an added column, shown and edited according to its type. */
function CustomCell(props: {
  task: Task;
  column: CustomColumn;
  value: FieldValue | undefined;
  editable: boolean;
  onChange: (value: FieldValue | null) => void;
}) {
  const label = () => `${props.column.title} of ${props.task.title}`;
  const text = () => fieldInputText(props.value);

  function commit(raw: string): string | null {
    const parsed = parseFieldInput(props.column.type, raw);
    if ("error" in parsed) return parsed.error;
    props.onChange(parsed.value);
    return null;
  }

  return (
    <Switch>
      <Match when={props.column.type === "checkbox"}>
        <div class="flex justify-center">
          <input
            type="checkbox"
            aria-label={label()}
            checked={props.value === true}
            disabled={!props.editable}
            onChange={(e) =>
              props.onChange(e.currentTarget.checked ? true : null)
            }
            class={cn(
              "size-5 cursor-pointer rounded-sm accent-primary disabled:cursor-not-allowed disabled:opacity-60",
              focusRing,
            )}
          />
        </div>
      </Match>
      <Match when={props.column.type === "richtext"}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          multiline
          linksInside
          placeholder="Notes… **bold**, *italic*, [link](https://…)"
          onCommit={commit}
        >
          <Show when={typeof props.value === "string"} fallback={EMPTY_VALUE}>
            <RichText text={props.value as string} />
          </Show>
        </CellEditor>
      </Match>
      <Match when={props.column.type === "link"}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          linksInside
          placeholder="https://example.com"
          onCommit={commit}
        >
          <Show
            when={
              typeof props.value === "string" && safeHref(props.value)
                ? props.value
                : null
            }
            fallback={EMPTY_VALUE}
          >
            {(value) => (
              <a
                href={safeHref(value()) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                title={value()}
                class={cn(
                  "flex min-w-0 items-center gap-1 rounded-sm text-sm text-primary underline",
                  focusRing,
                )}
              >
                <span class="truncate">
                  {value().replace(/^(https?:\/\/|mailto:)/i, "")}
                </span>
                <IconExternalLink
                  aria-hidden="true"
                  class="size-3.5 shrink-0"
                />
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Show>
        </CellEditor>
      </Match>
      <Match when={props.column.type === "tags"}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          placeholder="design, urgent"
          onCommit={commit}
        >
          <Show
            when={Array.isArray(props.value) && props.value}
            fallback={EMPTY_VALUE}
          >
            {(tags) => (
              <span class="flex flex-wrap gap-1">
                <For each={tags()}>
                  {(tag) => (
                    <span class="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                      {tag}
                    </span>
                  )}
                </For>
              </span>
            )}
          </Show>
        </CellEditor>
      </Match>
      <Match when={props.column.type === "number"}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          inputMode="decimal"
          placeholder="0"
          onCommit={commit}
        >
          <Show when={typeof props.value === "number"} fallback={EMPTY_VALUE}>
            <span class="block text-right font-mono tabular-nums">
              {(props.value as number).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}
            </span>
          </Show>
        </CellEditor>
      </Match>
      <Match when={props.column.type === "date"}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          inputType="date"
          onCommit={commit}
        >
          <Show when={typeof props.value === "string"} fallback={EMPTY_VALUE}>
            {shortDay(props.value as string)}
          </Show>
        </CellEditor>
      </Match>
      <Match when={true}>
        <CellEditor
          label={label()}
          initial={text()}
          editable={props.editable}
          onCommit={commit}
        >
          <Show when={typeof props.value === "string"} fallback={EMPTY_VALUE}>
            <span class="line-clamp-2 break-words">
              {props.value as string}
            </span>
          </Show>
        </CellEditor>
      </Match>
    </Switch>
  );
}

// ─── Adding ──────────────────────────────────────────────────────────────

/**
 * "Add task" turns into a text field in place; Enter adds and keeps the field
 * open for the next one, Escape closes it. Anything else about the task can be
 * set by opening it afterwards.
 */
function QuickAdd(props: {
  /** Where the new item lands, for screen readers: a group or a task. */
  group: string;
  /** "task" or "subtask". */
  noun?: string;
  onAdd: (title: string) => Promise<boolean>;
}) {
  const noun = () => props.noun ?? "task";
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
          Add {noun()}
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
        <Field.Root class="min-w-0 flex-1">
          <Field.Label class="sr-only">
            New {noun()} in {props.group}
          </Field.Label>
          <Field.Input
            ref={input}
            type="text"
            maxlength={160}
            value={value()}
            disabled={busy()}
            placeholder={`${noun() === "task" ? "Task" : "Subtask"} name, then Enter`}
            aria-label={`New ${noun()} in ${props.group}`}
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
            class="h-9 min-w-0 w-full flex-1 rounded-sm border border-border-strong bg-surface px-2.5 text-base text-text placeholder:text-text-muted/80 focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary md:text-sm"
          />
        </Field.Root>
        <Show when={busy()}>
          <Spinner class="size-4 text-text-muted" />
        </Show>
      </form>
    </Show>
  );
}

// ─── Hierarchy ───────────────────────────────────────────────────────────

/** Expands a task's subtasks; keeps the column free when there is nothing to open. */
function HierarchyToggle(props: {
  task: Task;
  expanded: boolean;
  available: boolean;
  onToggle: (task: Task) => void;
}) {
  return (
    <Show
      when={props.available}
      fallback={<span aria-hidden="true" class="size-8 shrink-0" />}
    >
      <button
        type="button"
        aria-expanded={props.expanded}
        aria-label={`${props.expanded ? "Hide" : "Show"} subtasks of ${props.task.title}`}
        onClick={() => props.onToggle(props.task)}
        class={cn(
          "grid size-8 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text",
          focusRing,
        )}
      >
        <IconChevronRight
          aria-hidden="true"
          class={cn(
            "size-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none",
            props.expanded && "rotate-90",
          )}
        />
      </button>
    </Show>
  );
}

/** The corner arrow that marks a row as belonging to the task above it. */
function HierarchyIndicator() {
  return (
    <IconCornerDownRight
      aria-hidden="true"
      class="size-4 shrink-0 text-text-muted"
    />
  );
}

/** Small facts beside the title: how far through its subtasks a task is. */
function TaskMetadata(props: { subtasks: Task[] }) {
  const done = () => props.subtasks.filter((t) => t.column === "done").length;
  return (
    <Show when={props.subtasks.length > 0}>
      <span class="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs tabular-nums text-text-muted">
        {done()}/{props.subtasks.length}
        <span class="sr-only"> subtasks done</span>
      </span>
    </Show>
  );
}

// ─── Table state ─────────────────────────────────────────────────────────

export type OptionalColumn = "description" | "priority";
export type TableColumns = Record<OptionalColumn, boolean>;
export const DEFAULT_COLUMNS: TableColumns = {
  description: true,
  priority: true,
};

const OPTIONAL_COLUMNS: ReadonlyArray<{ key: OptionalColumn; label: string }> =
  [
    { key: "description", label: "Description" },
    { key: "priority", label: "Priority" },
  ];

type TableProps = {
  groups: TaskGroup[];
  /** Which optional columns show; the toolbar's Columns menu owns this. */
  columns: TableColumns;
  /** Column heading text, with the team's own names applied. */
  headings: Record<HeadingKey, string>;
  onRenameHeading: (field: HeadingKey, title: string) => void;
  /** Columns the team added (shown only in custom mode) and their values. */
  customColumns: CustomColumn[];
  /** Adding, renaming and deleting columns is for the owner and admins. */
  canManageColumns: boolean;
  /** The column sorts in force, first to last. */
  columnSorts: ColumnSort[];
  onSort: (key: string, dir: SortDir, mode: "replace" | "add") => void;
  onRemoveSort: (key: string) => void;
  onClearSorts: () => void;
  onInsertColumn: (type: FieldType, placement: FieldPlacement) => void;
  onDuplicateColumn: (column: CustomColumn) => void;
  onChangeColumnType: (column: CustomColumn, type: FieldType) => void;
  onMoveColumn: (column: CustomColumn, direction: "left" | "right") => void;
  onClearColumn: (column: CustomColumn) => void;
  onHideColumn: (field: OptionalColumn) => void;
  fieldValues: FieldValues;
  onAddColumn: (type: FieldType) => void;
  onRenameColumn: (id: string, title: string) => void;
  onDeleteColumn: (column: CustomColumn) => void;
  onFieldChange: (
    task: Task,
    column: CustomColumn,
    value: FieldValue | null,
  ) => void;
  /** Subtasks by parent id (every subtask, whatever the filters say). */
  subtasks: ReadonlyMap<string, Task[]>;
  now: Date;
  movingId: string | null;
  canCreate: boolean;
  canEdit: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, column: TaskColumn) => void;
  onDelete: (task: Task) => void;
  onQuickAdd: (group: TaskGroup, title: string) => Promise<boolean>;
  onAddSubtask: (parent: Task, title: string) => Promise<boolean>;
  /** People a task can be assigned to, for the assignee cell's editor. */
  members: TeamMember[];
  /** Saves a double-click edit; resolves true when it went through. */
  onEdit: (task: Task, patch: TaskPatch) => Promise<boolean>;
  /** True when `Group by > Custom` is active: headers become editable. */
  isCustom?: boolean;
  onCreateSection?: () => void;
  onRenameSection?: (group: TaskGroup, title: string) => void;
  onDeleteSection?: (group: TaskGroup) => void;
  /** Move a task into a local custom section (`null` = No section). */
  onMoveToSection?: (task: Task, sectionId: string | null) => void;
};

/** What every group needs: the props plus the table's own view state. */
type TableState = TableProps & {
  expanded: ReadonlySet<string>;
  onExpand: (task: Task) => void;
};

/** Title, status, date, assignee and actions are always there. */
const colCount = (t: TableState) =>
  5 +
  (t.columns.description ? 1 : 0) +
  (t.columns.priority ? 1 : 0) +
  t.customColumns.length;

// ─── Group header ────────────────────────────────────────────────────────

function GroupToggle(props: { group: TaskGroup; open: boolean }) {
  return (
    <>
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
    </>
  );
}

const th =
  "px-3 py-2 text-center text-sm font-medium whitespace-nowrap text-text-muted";

const triggerClass = cn(
  "flex min-h-11 min-w-0 items-center gap-3 rounded-sm text-left",
  focusRing,
);

/** Whether this group is a user-created custom section (not "No section"). */
function isNamedSection(group: TaskGroup): boolean {
  return typeof group.customSectionId === "string";
}

/**
 * Editable custom-section title. Renders outside the collapse trigger so a
 * click to collapse never fights with editing; dbl-click (or Enter on the
 * preview) renames, Escape cancels.
 */
function CustomSectionTitle(props: { group: TaskGroup; table: TableState }) {
  const g = () => props.group;
  const rename = () => props.table.onRenameSection;
  const previewClass =
    "block max-w-full min-w-0 truncate rounded-sm text-left font-display text-base font-semibold text-text hover:text-primary";

  // The editor is controlled, so the text being typed has to live here too;
  // otherwise every keystroke is reset to the saved title and the commit
  // reports the old value.
  const [draft, setDraft] = createSignal(g().label);
  createEffect(() => setDraft(g().label));

  return (
    <Show
      when={g().customSectionId !== undefined && rename()}
      fallback={
        <span class="truncate font-display text-base font-semibold text-text">
          {g().label}
        </span>
      }
    >
      <Editable.Root
        value={draft()}
        onValueChange={(details: { value: string }) => setDraft(details.value)}
        activationMode="dblclick"
        submitMode="both"
        selectOnFocus
        maxLength={80}
        onValueCommit={(details: { value: string }) => {
          const next = details.value.trim();
          if (next === g().label) return;
          // Clearing the catch-all's name resets it to "No section"; a named
          // section keeps its old title instead of going blank.
          if (next || g().customSectionId === null) rename()?.(g(), next);
        }}
        class="flex min-w-0 flex-1 items-center gap-1"
      >
        <Editable.Label class="sr-only">
          Rename section {g().label}
        </Editable.Label>
        <Editable.Area class="min-w-0" title="Double-click to rename section">
          <Editable.Preview class={cn(previewClass, focusRing)} />
          <Editable.Input aria-label="Section title" class={editorInput} />
        </Editable.Area>
        {/* Touch and discoverability: same edit, no double-click needed. */}
        <Editable.Control class="shrink-0">
          <Editable.EditTrigger
            aria-label={`Rename section ${g().label}`}
            title="Rename section"
            class={cn(
              "grid size-9 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-primary",
              focusRing,
            )}
          >
            <IconPencil aria-hidden="true" class="size-4" />
          </Editable.EditTrigger>
        </Editable.Control>
      </Editable.Root>
    </Show>
  );
}

function SectionMenu(props: { group: TaskGroup; table: TableState }) {
  const t = () => props.table;
  return (
    <Show
      when={isNamedSection(props.group) && t().onDeleteSection && t().canCreate}
    >
      <button
        type="button"
        aria-label={`Delete section ${props.group.label}`}
        title="Delete section (its tasks move to No section)"
        onClick={() => t().onDeleteSection?.(props.group)}
        class={cn(
          "grid size-9 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-error/10 hover:text-error",
          focusRing,
        )}
      >
        <IconTrash aria-hidden="true" class="size-4" />
      </button>
    </Show>
  );
}

function GroupCount(props: { group: TaskGroup }) {
  return (
    <span class="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs tabular-nums text-primary">
      {props.group.tasks.length}
      <span class="sr-only"> {taskCountLabel(props.group.tasks.length)}</span>
    </span>
  );
}

/** Small buttons that appear on hover or focus, so cells and headings stay calm. */
const CELL_ACTION =
  "grid size-6 place-items-center rounded-sm text-text-muted opacity-0 transition-opacity duration-[var(--duration-fast)] group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 hover:text-primary";

const FIELD_ICON: Record<FieldType, typeof IconTextCaption> = {
  text: IconTextCaption,
  richtext: IconAlignLeft,
  number: IconHash,
  link: IconLink,
  tags: IconTag,
  checkbox: IconSquareCheck,
  date: IconCalendar,
};

/** Which column a heading belongs to: one of the table's own, or an added one. */
type ColumnTarget =
  | { kind: "builtin"; field: HeadingKey }
  | { kind: "custom"; column: CustomColumn };

const targetKey = (target: ColumnTarget) =>
  target.kind === "builtin" ? target.field : customSortKey(target.column.id);

/** What "ascending" and "descending" mean for this column, in plain words. */
function sortWords(target: ColumnTarget): [string, string] {
  if (target.kind === "custom") {
    switch (target.column.type) {
      case "number":
        return ["Low to high", "High to low"];
      case "date":
        return ["Earliest first", "Latest first"];
      case "checkbox":
        return ["Unchecked first", "Checked first"];
      default:
        return ["A to Z", "Z to A"];
    }
  }
  switch (target.field) {
    case "status":
      return ["To do first", "Done first"];
    case "date":
      return ["Earliest first", "Latest first"];
    case "priority":
      return ["Low to high", "High to low"];
    default:
      return ["A to Z", "Z to A"];
  }
}

/** The arrow (and place in the order, when several sorts are on) in a heading. */
function SortMark(props: { dir: SortDir; order: number; several: boolean }) {
  return (
    <span class="inline-flex shrink-0 items-center text-primary">
      <Dynamic
        component={props.dir === "asc" ? IconArrowUp : IconArrowDown}
        aria-hidden="true"
        class="size-3.5"
      />
      <Show when={props.several}>
        <span aria-hidden="true" class="font-mono text-xs tabular-nums">
          {props.order}
        </span>
      </Show>
      <span class="sr-only">
        Sorted {props.dir === "asc" ? "ascending" : "descending"}
        {props.several ? `, sort ${props.order}` : ""}
      </span>
    </span>
  );
}

/** A nested menu: a row that opens a second list beside it. */
function SubMenu(props: {
  label: string;
  icon: typeof IconCopy;
  onSelect: (value: string) => void;
  children: JSX.Element;
}) {
  return (
    <Menu.Root
      positioning={{ placement: "right-start", gutter: 2 }}
      onSelect={(details) => props.onSelect(details.value)}
    >
      <Menu.TriggerItem class={menuItem}>
        <Dynamic
          component={props.icon}
          aria-hidden="true"
          class="size-4 shrink-0 text-text-muted"
        />
        <span class="flex-1">{props.label}</span>
        <IconChevronRight
          aria-hidden="true"
          class="size-4 shrink-0 text-text-muted"
        />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={cn(menuContent, "min-w-48")}>
            {props.children}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/** One row per column type; the current one is shown ticked and can't be picked. */
function TypeItems(props: { current?: FieldType }) {
  return (
    <For each={FIELD_TYPES}>
      {(type) => (
        <Menu.Item
          value={type.value}
          disabled={props.current === type.value}
          class={cn(menuItem, "data-[disabled]:opacity-60")}
        >
          <Dynamic
            component={FIELD_ICON[type.value]}
            aria-hidden="true"
            class="size-4 shrink-0 text-text-muted"
          />
          <Menu.ItemText class="flex-1">{type.label}</Menu.ItemText>
          <Show when={props.current === type.value}>
            <IconCheck aria-hidden="true" class="size-4 text-primary" />
          </Show>
        </Menu.Item>
      )}
    </For>
  );
}

/**
 * The chevron on every column heading (Group by > Custom): sort, add a sort,
 * rename, duplicate, change the type, add a column to either side, move,
 * clear or delete. Anyone can sort; what changes the table's structure is
 * for the owner and admins, so it isn't offered to anyone else.
 */
function ColumnMenu(props: {
  target: ColumnTarget;
  label: string;
  table: TableState;
  canRename: boolean;
  onRename: () => void;
}) {
  const t = () => props.table;
  const key = () => targetKey(props.target);
  const column = () =>
    props.target.kind === "custom" ? props.target.column : undefined;
  const words = () => sortWords(props.target);
  const place = () => t().columnSorts.findIndex((s) => s.key === key());
  const customs = () => t().customColumns;
  const index = () => customs().findIndex((c) => c.id === column()?.id);
  const manage = () => t().canManageColumns;
  const optional = () =>
    props.target.kind === "builtin" &&
    (props.target.field === "description" || props.target.field === "priority")
      ? props.target.field
      : undefined;

  /** A column inserted right of a built-in one leads the added columns. */
  const rightOf = (): FieldPlacement => {
    const own = column();
    if (own) return { afterId: own.id };
    const first = customs()[0];
    return first ? { beforeId: first.id } : {};
  };

  function act(value: string) {
    const own = column();
    switch (value) {
      case "sort:asc":
      case "sort:desc":
        return t().onSort(
          key(),
          value === "sort:asc" ? "asc" : "desc",
          "replace",
        );
      case "sort:remove":
        return t().onRemoveSort(key());
      case "sort:clear":
        return t().onClearSorts();
      case "rename":
        return props.onRename();
      case "hide":
        return optional() && t().onHideColumn(optional() as OptionalColumn);
      case "duplicate":
        return own && t().onDuplicateColumn(own);
      case "move:left":
      case "move:right":
        return (
          own && t().onMoveColumn(own, value === "move:left" ? "left" : "right")
        );
      case "clear":
        return own && t().onClearColumn(own);
      case "delete":
        return own && t().onDeleteColumn(own);
    }
  }

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", gutter: 4 }}
      onSelect={(details) => act(details.value)}
    >
      <Menu.Trigger
        aria-label={`Options for the ${props.label} column`}
        title="Column options"
        class={cn(
          "grid size-6 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text data-[state=open]:bg-primary-soft",
          focusRing,
        )}
      >
        <IconChevronDown aria-hidden="true" class="size-3.5" />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={cn(menuContent, "min-w-56")}>
            <Menu.Item value="sort:asc" class={menuItem}>
              <IconSortAscending
                aria-hidden="true"
                class="size-4 text-text-muted"
              />
              Sort: {words()[0]}
            </Menu.Item>
            <Menu.Item value="sort:desc" class={menuItem}>
              <IconSortDescending
                aria-hidden="true"
                class="size-4 text-text-muted"
              />
              Sort: {words()[1]}
            </Menu.Item>
            <SubMenu
              label="Add sort"
              icon={IconArrowsSort}
              onSelect={(value) =>
                t().onSort(key(), value === "asc" ? "asc" : "desc", "add")
              }
            >
              <Menu.Item value="asc" class={menuItem}>
                {words()[0]}
              </Menu.Item>
              <Menu.Item value="desc" class={menuItem}>
                {words()[1]}
              </Menu.Item>
            </SubMenu>
            <Show when={place() >= 0}>
              <Menu.Item value="sort:remove" class={menuItem}>
                <IconX aria-hidden="true" class="size-4 text-text-muted" />
                Remove this sort
              </Menu.Item>
            </Show>
            <Show when={t().columnSorts.length > 1}>
              <Menu.Item value="sort:clear" class={menuItem}>
                <IconX aria-hidden="true" class="size-4 text-text-muted" />
                Clear all sorts
              </Menu.Item>
            </Show>

            <Show when={props.canRename || optional() || manage()}>
              <Menu.Separator class="my-1 h-px border-0 bg-border" />
            </Show>
            <Show when={props.canRename}>
              <Menu.Item value="rename" class={menuItem}>
                <IconPencil aria-hidden="true" class="size-4 text-text-muted" />
                Rename
              </Menu.Item>
            </Show>
            <Show when={optional()}>
              <Menu.Item value="hide" class={menuItem}>
                <IconEyeOff aria-hidden="true" class="size-4 text-text-muted" />
                Hide column
              </Menu.Item>
            </Show>

            <Show when={manage() && column()}>
              {(own) => (
                <>
                  <Menu.Item value="duplicate" class={menuItem}>
                    <IconCopy
                      aria-hidden="true"
                      class="size-4 text-text-muted"
                    />
                    Duplicate
                  </Menu.Item>
                  <SubMenu
                    label="Change type"
                    icon={IconTransform}
                    onSelect={(value) =>
                      t().onChangeColumnType(own(), value as FieldType)
                    }
                  >
                    <TypeItems current={own().type} />
                  </SubMenu>
                </>
              )}
            </Show>

            <Show when={manage()}>
              <Show when={column()}>
                <SubMenu
                  label="Add column to the left"
                  icon={IconColumnInsertLeft}
                  onSelect={(value) =>
                    t().onInsertColumn(value as FieldType, {
                      beforeId: column()?.id,
                    })
                  }
                >
                  <TypeItems />
                </SubMenu>
              </Show>
              <SubMenu
                label="Add column to the right"
                icon={IconColumnInsertRight}
                onSelect={(value) =>
                  t().onInsertColumn(value as FieldType, rightOf())
                }
              >
                <TypeItems />
              </SubMenu>
            </Show>

            <Show when={manage() && column()}>
              <Menu.Item
                value="move:left"
                disabled={index() <= 0}
                class={cn(menuItem, "data-[disabled]:opacity-60")}
              >
                <IconArrowLeft
                  aria-hidden="true"
                  class="size-4 text-text-muted"
                />
                Move left
              </Menu.Item>
              <Menu.Item
                value="move:right"
                disabled={index() === customs().length - 1}
                class={cn(menuItem, "data-[disabled]:opacity-60")}
              >
                <IconArrowRight
                  aria-hidden="true"
                  class="size-4 text-text-muted"
                />
                Move right
              </Menu.Item>
              <Menu.Separator class="my-1 h-px border-0 bg-border" />
              <Menu.Item value="clear" class={menuItem}>
                <IconEraser aria-hidden="true" class="size-4 text-text-muted" />
                Clear values
              </Menu.Item>
              <Menu.Item value="delete" class={cn(menuItem, "text-error")}>
                <IconTrash aria-hidden="true" class="size-4" />
                Delete column
              </Menu.Item>
            </Show>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/**
 * A column heading in custom mode: its name (double-click to rename, Enter
 * saves, Escape cancels, clearing restores the default), where it sits in the
 * sort order, and the options chevron.
 */
function ColumnHeader(props: {
  target: ColumnTarget;
  table: TableState;
  align?: "start";
}) {
  const [editing, setEditing] = createSignal(false);
  const target = () => props.target;
  const label = () => {
    const t = target();
    return t.kind === "builtin"
      ? props.table.headings[t.field]
      : t.column.title;
  };
  const ariaName = () => {
    const t = target();
    return t.kind === "builtin"
      ? DEFAULT_HEADINGS[t.field]
      : fieldTypeLabel(t.column.type);
  };
  // The table's own headings are named locally; added columns are the
  // owner's and admins' to rename.
  const canRename = () =>
    target().kind === "builtin" || props.table.canManageColumns;
  const sort = () => {
    const at = props.table.columnSorts.findIndex(
      (s) => s.key === targetKey(target()),
    );
    return at < 0
      ? undefined
      : { ...props.table.columnSorts[at], order: at + 1 };
  };

  function rename(title: string) {
    const t = target();
    if (t.kind === "builtin") props.table.onRenameHeading(t.field, title);
    else props.table.onRenameColumn(t.column.id, title);
  }

  return (
    <div
      class={cn(
        "group/heading flex min-w-0 items-center gap-1",
        props.align === "start" ? "justify-start" : "justify-center",
      )}
    >
      <Show when={target().kind === "custom" ? target() : undefined}>
        {(t) => {
          const column = () => (t() as { column: CustomColumn }).column;
          return (
            <span title={`${fieldTypeLabel(column().type)} column`}>
              <Dynamic
                component={FIELD_ICON[column().type]}
                aria-hidden="true"
                class="size-3.5 shrink-0"
              />
              <span class="sr-only">
                {fieldTypeLabel(column().type)} column
              </span>
            </span>
          );
        }}
      </Show>
      <Show
        when={canRename()}
        fallback={<span class="truncate">{label()}</span>}
      >
        <HeadingEditor
          label={label()}
          ariaName={ariaName()}
          editing={editing()}
          onEditingChange={setEditing}
          onRename={rename}
        />
      </Show>
      <Show when={sort()}>
        {(s) => (
          <SortMark
            dir={s().dir}
            order={s().order}
            several={props.table.columnSorts.length > 1}
          />
        )}
      </Show>
      <ColumnMenu
        target={target()}
        label={label()}
        table={props.table}
        canRename={canRename()}
        // The menu hands focus back to its button as it closes; waiting a
        // beat keeps that from taking focus off the field and cancelling it.
        onRename={() => setTimeout(() => setEditing(true), 120)}
      />
    </div>
  );
}

/** A heading of the table's own: plain text, except in custom mode. */
function ColumnHeading(props: {
  field: HeadingKey;
  table: TableState;
  align?: "start";
}) {
  return (
    <Show when={props.table.isCustom} fallback={DEFAULT_HEADINGS[props.field]}>
      <ColumnHeader
        target={{ kind: "builtin", field: props.field }}
        table={props.table}
        align={props.align}
      />
    </Show>
  );
}

/** The rename-in-place field of a heading. */
function HeadingEditor(props: {
  label: string;
  ariaName: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (title: string) => void;
}) {
  // Controlled editor: keep the typed text here, or each keystroke is reset.
  const [draft, setDraft] = createSignal(props.label);
  createEffect(() => setDraft(props.label));

  return (
    <Editable.Root
      value={draft()}
      onValueChange={(details: { value: string }) => setDraft(details.value)}
      edit={props.editing}
      onEditChange={(details: { edit: boolean }) =>
        props.onEditingChange(details.edit)
      }
      activationMode="dblclick"
      submitMode="both"
      selectOnFocus
      maxLength={40}
      onValueCommit={(details: { value: string }) => {
        const next = details.value.trim();
        if (next !== props.label) props.onRename(next);
      }}
      class="min-w-0"
    >
      <Editable.Label class="sr-only">
        Rename the {props.label} column
      </Editable.Label>
      <Editable.Area class="min-w-0" title="Double-click to rename column">
        <Editable.Preview class={cn("block truncate rounded-sm", focusRing)} />
        <Editable.Input
          aria-label={`${props.ariaName} column title`}
          class={cn(editorInput, "h-8 min-w-24 text-center font-normal")}
        />
      </Editable.Area>
    </Editable.Root>
  );
}

/** Column headings; the first cell doubles as the group's collapse control. */
function TableHeader(props: {
  group: TaskGroup;
  open: boolean;
  table: TableState;
}) {
  const custom = () => props.group.customSectionId !== undefined;
  // Every column of the table, so the section bar can span the full width.
  const span = () => colCount(props.table);
  return (
    <thead>
      {/* A custom section's controls get their own full-width bar: the title
          column is too narrow to hold a title, count and two buttons. */}
      <Show when={custom()}>
        <tr class="border-b border-border bg-background/60">
          <th scope="colgroup" colSpan={span()} class="px-3 py-1 text-left">
            <div class="flex min-h-11 min-w-0 items-center gap-2">
              <Collapsible.Trigger
                aria-label={`${props.open ? "Collapse" : "Expand"} section ${props.group.label}`}
                class={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md",
                  RAIL[props.group.tone],
                  ON_RAIL[props.group.tone],
                  focusRing,
                )}
              >
                <IconChevronDown
                  aria-hidden="true"
                  class={cn(
                    "size-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none",
                    !props.open && "-rotate-90",
                  )}
                />
              </Collapsible.Trigger>
              <CustomSectionTitle group={props.group} table={props.table} />
              <GroupCount group={props.group} />
              <SectionMenu group={props.group} table={props.table} />
            </div>
          </th>
        </tr>
      </Show>
      <tr class="border-b border-border bg-background/60">
        <th scope="col" class="px-3 py-1 text-left">
          <Show when={!custom()}>
            <Collapsible.Trigger class={triggerClass}>
              <GroupToggle group={props.group} open={props.open} />
            </Collapsible.Trigger>
          </Show>
          <span class="sr-only">Task</span>
        </th>
        <Show when={props.table.columns.description}>
          <th scope="col" class={cn(th, "text-left")}>
            <ColumnHeading
              field="description"
              table={props.table}
              align="start"
            />
          </th>
        </Show>
        <th scope="col" class={th}>
          <ColumnHeading field="status" table={props.table} />
        </th>
        <th scope="col" class={th}>
          <ColumnHeading field="date" table={props.table} />
        </th>
        <th scope="col" class={th}>
          <ColumnHeading field="assignee" table={props.table} />
        </th>
        <Show when={props.table.columns.priority}>
          <th scope="col" class={th}>
            <ColumnHeading field="priority" table={props.table} />
          </th>
        </Show>
        <For each={props.table.customColumns}>
          {(column) => (
            <th scope="col" class={th}>
              <ColumnHeader
                target={{ kind: "custom", column }}
                table={props.table}
              />
            </th>
          )}
        </For>
        <th scope="col" class={th}>
          <span class="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────

const rowClass =
  "border-b border-border transition-colors duration-[var(--duration-fast)] hover:bg-background/60";

function Rail(props: { tone: GroupTone }) {
  return (
    <span
      aria-hidden="true"
      class={cn("absolute inset-y-0 left-0 w-1.5", RAIL[props.tone])}
    />
  );
}

/**
 * Every cell after the title, in column order: description, status, date,
 * assignee, priority, actions. A task and a subtask share them, so a subtask
 * has the same fields and the same double-click editing.
 */
function RowCells(props: { task: Task; table: TableState; lines?: 1 | 2 }) {
  const t = () => props.table;
  const editable = () => t().canEdit(props.task);
  return (
    <>
      <Show when={t().columns.description}>
        <td class="px-3 py-1.5">
          <DescriptionCell
            task={props.task}
            editable={editable()}
            onOpen={t().onOpen}
            lines={props.lines}
          />
        </td>
      </Show>
      <td class="px-3 py-1.5">
        <StatusCell
          task={props.task}
          editable={editable()}
          size="row"
          onStatus={t().onStatus}
        />
      </td>
      <td class="px-3 py-1.5">
        <DateCell
          task={props.task}
          now={t().now}
          size="row"
          editable={editable()}
        />
      </td>
      <td class="px-3 py-1.5">
        <AssigneeCell task={props.task} editable={editable()} />
      </td>
      <Show when={t().columns.priority}>
        <td class="px-3 py-1.5 text-center">
          <PriorityCell task={props.task} editable={editable()} />
        </td>
      </Show>
      <For each={t().customColumns}>
        {(column) => (
          <td class="px-3 py-1.5 align-middle">
            <CustomCell
              task={props.task}
              column={column}
              value={t().fieldValues[props.task.id]?.[column.id]}
              editable={editable()}
              onChange={(value) => t().onFieldChange(props.task, column, value)}
            />
          </td>
        )}
      </For>
      <td class="px-2 py-1.5 text-center">
        <RowMenu
          task={props.task}
          editable={editable()}
          onOpen={t().onOpen}
          onDelete={t().onDelete}
          table={t()}
        />
      </td>
    </>
  );
}

/** A subtask: indented under its parent, with the same cells as any task. */
function SubtaskItem(props: {
  task: Task;
  tone: GroupTone;
  table: TableState;
}) {
  const t = () => props.table;
  const editable = () => t().canEdit(props.task);
  return (
    <tr
      class={cn(
        rowClass,
        "bg-background/30",
        t().movingId === props.task.id && "opacity-60",
      )}
    >
      <td class="relative py-1.5 pr-3 pl-5">
        <Rail tone={props.tone} />
        <div class="flex min-w-0 items-center gap-2 pl-9">
          <HierarchyIndicator />
          <TaskTitle
            task={props.task}
            editable={editable()}
            onOpen={t().onOpen}
          />
        </div>
      </td>
      <RowCells task={props.task} table={t()} lines={1} />
    </tr>
  );
}

/** The closing row of a task's subtasks: type a title, press Enter. */
function AddSubtaskAction(props: { parent: Task; table: TableState }) {
  return (
    <Show when={props.table.canCreate}>
      <tr class="border-b border-border bg-background/40">
        <td colSpan={colCount(props.table)} class="py-1.5 pr-3 pl-5">
          <div class="pl-9">
            <QuickAdd
              noun="subtask"
              group={props.parent.title}
              onAdd={(title) => props.table.onAddSubtask(props.parent, title)}
            />
          </div>
        </td>
      </tr>
    </Show>
  );
}

function SubtaskList(props: {
  parent: Task;
  subtasks: Task[];
  tone: GroupTone;
  table: TableState;
}) {
  return (
    <>
      <For each={props.subtasks}>
        {(task) => (
          <SubtaskItem task={task} tone={props.tone} table={props.table} />
        )}
      </For>
      <AddSubtaskAction parent={props.parent} table={props.table} />
    </>
  );
}

/** A top-level task and, when expanded, its subtasks. */
function TaskItem(props: { task: Task; tone: GroupTone; table: TableState }) {
  const t = () => props.table;
  const editable = () => t().canEdit(props.task);
  const subtasks = () => t().subtasks.get(props.task.id) ?? [];
  /** A subtask shown on its own (its parent is filtered out) holds no subtasks. */
  const canNest = () => !props.task.parentId;
  const expandable = () =>
    canNest() && (subtasks().length > 0 || t().canCreate);
  const expanded = () => expandable() && t().expanded.has(props.task.id);

  return (
    <>
      <tr class={cn(rowClass, t().movingId === props.task.id && "opacity-60")}>
        <td class="relative py-1.5 pr-3 pl-5">
          <Rail tone={props.tone} />
          <div class="flex min-w-0 items-center gap-1">
            <HierarchyToggle
              task={props.task}
              expanded={expanded()}
              available={expandable()}
              onToggle={t().onExpand}
            />
            <TaskTitle
              task={props.task}
              editable={editable()}
              onOpen={t().onOpen}
            />
            <TaskMetadata subtasks={subtasks()} />
          </div>
        </td>
        <RowCells task={props.task} table={t()} />
      </tr>
      <Show when={expanded()}>
        <SubtaskList
          parent={props.task}
          subtasks={subtasks()}
          tone={props.tone}
          table={props.table}
        />
      </Show>
    </>
  );
}

// ─── Phone cards ─────────────────────────────────────────────────────────

function SubtaskCard(props: { task: Task; table: TableState }) {
  const t = () => props.table;
  const editable = () => t().canEdit(props.task);
  return (
    <li
      class={cn(
        "flex flex-col gap-2 border-t border-border py-2.5 pl-3",
        t().movingId === props.task.id && "opacity-60",
      )}
    >
      <div class="flex items-center gap-2">
        <HierarchyIndicator />
        <div class="min-w-0 flex-1">
          <TaskTitle
            task={props.task}
            editable={editable()}
            onOpen={t().onOpen}
          />
        </div>
        <AssigneeStack
          people={assigneesOf(props.task)}
          max={2}
          class="size-7"
        />
        <RowMenu
          task={props.task}
          editable={editable()}
          onOpen={t().onOpen}
          onDelete={t().onDelete}
          table={t()}
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <StatusCell
          task={props.task}
          editable={editable()}
          size="card"
          onStatus={t().onStatus}
        />
        <DateCell
          task={props.task}
          now={t().now}
          size="card"
          editable={editable()}
        />
      </div>
    </li>
  );
}

function TaskCard(props: { task: Task; tone: GroupTone; table: TableState }) {
  const t = () => props.table;
  const editable = () => t().canEdit(props.task);
  const subtasks = () => t().subtasks.get(props.task.id) ?? [];
  const expandable = () =>
    !props.task.parentId && (subtasks().length > 0 || t().canCreate);
  const expanded = () => expandable() && t().expanded.has(props.task.id);

  return (
    <li
      class={cn(
        "relative flex flex-col gap-3 border-b border-border py-3 pr-3 pl-5",
        t().movingId === props.task.id && "opacity-60",
      )}
    >
      <Rail tone={props.tone} />
      <div class="flex items-start gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1 pt-0.5">
          <HierarchyToggle
            task={props.task}
            expanded={expanded()}
            available={expandable()}
            onToggle={t().onExpand}
          />
          <TaskTitle
            task={props.task}
            editable={editable()}
            onOpen={t().onOpen}
          />
          <TaskMetadata subtasks={subtasks()} />
        </div>
        <AssigneeStack
          people={assigneesOf(props.task)}
          max={2}
          class="mt-1 size-8"
        />
        <RowMenu
          task={props.task}
          editable={editable()}
          onOpen={t().onOpen}
          onDelete={t().onDelete}
          table={t()}
        />
      </div>
      <Show when={props.task.description?.trim()}>
        <DescriptionCell
          task={props.task}
          editable={editable()}
          onOpen={t().onOpen}
        />
      </Show>
      <div class="grid grid-cols-2 gap-2">
        <StatusCell
          task={props.task}
          editable={editable()}
          size="card"
          onStatus={t().onStatus}
        />
        <DateCell
          task={props.task}
          now={t().now}
          size="card"
          editable={editable()}
        />
      </div>
      <div>
        <PriorityCell task={props.task} editable={editable()} />
      </div>
      <Show when={expanded()}>
        <ul class="flex flex-col">
          <For each={subtasks()}>
            {(task) => <SubtaskCard task={task} table={props.table} />}
          </For>
        </ul>
        <Show when={t().canCreate}>
          <QuickAdd
            noun="subtask"
            group={props.task.title}
            onAdd={(title) => t().onAddSubtask(props.task, title)}
          />
        </Show>
      </Show>
    </li>
  );
}

// ─── Groups ──────────────────────────────────────────────────────────────

function TaskGroupTable(props: {
  group: TaskGroup;
  open: boolean;
  onToggle: () => void;
  table: TableState;
}) {
  const g = () => props.group;
  const open = () => props.open;
  const t = () => props.table;

  return (
    <Collapsible.Root
      open={open()}
      onOpenChange={(e) => {
        if (e.open !== open()) props.onToggle();
      }}
    >
      <section
        aria-label={`${g().label}, ${g().tasks.length} ${taskCountLabel(g().tasks.length)}`}
        class="overflow-hidden rounded-lg border border-border bg-surface"
      >
        {/* ── Desktop: a real table, header in the group's own bar ── */}
        <div class="hidden md:block">
          <div class="overflow-x-auto">
            <table
              class="w-full min-w-[880px] table-fixed border-collapse"
              style={{
                "min-width": `${880 + t().customColumns.length * 208}px`,
              }}
            >
              <caption class="sr-only">
                {g().label} — {g().tasks.length}{" "}
                {taskCountLabel(g().tasks.length)}
              </caption>
              <colgroup>
                <col />
                <Show when={t().columns.description}>
                  <col />
                </Show>
                <col class="w-40" />
                <col class="w-48" />
                <col class={t().isCustom ? "w-36" : "w-24"} />
                <Show when={t().columns.priority}>
                  <col class={t().isCustom ? "w-36" : "w-32"} />
                </Show>
                <For each={t().customColumns}>{() => <col class="w-52" />}</For>
                <col class="w-14" />
              </colgroup>
              <TableHeader group={g()} open={open()} table={t()} />
              <tbody hidden={!open()}>
                <For each={g().tasks}>
                  {(task) => (
                    <TaskItem task={task} tone={g().tone} table={t()} />
                  )}
                </For>

                {/* Closing row: add a task here. It spans the row so nothing
                  in it reads as the cells of another task. */}
                <tr class="bg-background/40">
                  <td colSpan={colCount(t())} class="py-1.5 pr-3 pl-5">
                    <Show
                      when={t().canCreate && g().defaults}
                      fallback={
                        <Show when={g().tasks.length === 0}>
                          <span class="text-sm text-text-muted">
                            Nothing here.
                          </span>
                        </Show>
                      }
                    >
                      <QuickAdd
                        group={g().label}
                        onAdd={(title) => t().onQuickAdd(g(), title)}
                      />
                    </Show>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Phones: the same group as stacked cards ── */}
        <div class="md:hidden">
          <div class="flex items-center justify-between gap-2 border-b border-border bg-background/60 px-3 py-1">
            <Show
              when={g().customSectionId !== undefined}
              fallback={
                <Collapsible.Trigger class={triggerClass}>
                  <GroupToggle group={g()} open={open()} />
                </Collapsible.Trigger>
              }
            >
              <div class="flex min-h-11 min-w-0 flex-1 items-center gap-2">
                <Collapsible.Trigger
                  aria-label={`${open() ? "Collapse" : "Expand"} section ${g().label}`}
                  class={cn(
                    "grid size-9 shrink-0 place-items-center rounded-md",
                    RAIL[g().tone],
                    ON_RAIL[g().tone],
                    focusRing,
                  )}
                >
                  <IconChevronDown
                    aria-hidden="true"
                    class={cn(
                      "size-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none",
                      !open() && "-rotate-90",
                    )}
                  />
                </Collapsible.Trigger>
                <CustomSectionTitle group={g()} table={t()} />
                <GroupCount group={g()} />
                <SectionMenu group={g()} table={t()} />
              </div>
            </Show>
          </div>
          <Collapsible.Content>
            <ul class="flex flex-col">
              <For each={g().tasks}>
                {(task) => <TaskCard task={task} tone={g().tone} table={t()} />}
              </For>
            </ul>
            <Show when={t().canCreate && g().defaults}>
              <div class="px-4 py-2">
                <QuickAdd
                  group={g().label}
                  onAdd={(title) => t().onQuickAdd(g(), title)}
                />
              </div>
            </Show>
          </Collapsible.Content>
        </div>
      </section>
    </Collapsible.Root>
  );
}

// ─── Table actions ───────────────────────────────────────────────────────

/**
 * "Add column": brings back the optional columns (description, priority) the
 * owner has hidden. Title, status, date, assignee and actions always stay.
 */
function AddColumnAction(props: {
  columns: TableColumns;
  onChange: (key: OptionalColumn, shown: boolean) => void;
}) {
  const hidden = () => OPTIONAL_COLUMNS.filter((c) => !props.columns[c.key]);
  return (
    <Menu.Root positioning={{ placement: "bottom-end", gutter: 4 }}>
      <Menu.Trigger
        class={cn(
          "inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text data-[state=open]:bg-primary-soft",
          focusRing,
        )}
      >
        <Show
          when={hidden().length > 0}
          fallback={<IconColumns3 aria-hidden="true" class="size-4" />}
        >
          <IconPlus aria-hidden="true" class="size-4" />
        </Show>
        {hidden().length > 0 ? "Add column" : "Columns"}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={menuContent}>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                Show columns
              </Menu.ItemGroupLabel>
              <For each={OPTIONAL_COLUMNS}>
                {(column) => (
                  <Menu.CheckboxItem
                    value={column.key}
                    checked={props.columns[column.key]}
                    onCheckedChange={(shown) =>
                      props.onChange(column.key, shown)
                    }
                    class={menuItem}
                  >
                    <Menu.ItemText class="flex-1">{column.label}</Menu.ItemText>
                    <Menu.ItemIndicator class="text-primary">
                      <IconCheck aria-hidden="true" class="size-4" />
                    </Menu.ItemIndicator>
                  </Menu.CheckboxItem>
                )}
              </For>
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/** "New column": pick what kind of data it holds; it is added with a default name. */
function NewColumnMenu(props: {
  count: number;
  onAdd: (type: FieldType) => void;
}) {
  const full = () => props.count >= MAX_FIELD_COLUMNS;
  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 4 }}
      onSelect={(details) => props.onAdd(details.value as FieldType)}
    >
      <Menu.Trigger
        disabled={full()}
        title={full() ? `Up to ${MAX_FIELD_COLUMNS} added columns` : undefined}
        class={cn(
          "inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:bg-primary-soft",
          focusRing,
        )}
      >
        <IconColumnInsertRight aria-hidden="true" class="size-4" />
        New column
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={cn(menuContent, "min-w-64")}>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                Column type
              </Menu.ItemGroupLabel>
              <For each={FIELD_TYPES}>
                {(type) => (
                  <Menu.Item value={type.value} class={menuItem}>
                    <Dynamic
                      component={FIELD_ICON[type.value]}
                      aria-hidden="true"
                      class="size-4 shrink-0 text-text-muted"
                    />
                    <span class="flex min-w-0 flex-1 flex-col">
                      <Menu.ItemText>{type.label}</Menu.ItemText>
                      <span class="text-xs text-text-muted">{type.hint}</span>
                    </span>
                  </Menu.Item>
                )}
              </For>
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/** New section and Columns; rendered in the toolbar, beside Filter/Sort/Group. */
export function TableActions(props: {
  columns: TableColumns;
  onChange: (key: OptionalColumn, shown: boolean) => void;
  isCustom?: boolean;
  canCreateSection?: boolean;
  onCreateSection?: () => void;
  /** How many columns the team has added, against the cap. */
  addedColumns?: number;
  /** Owner and admins only; everyone else doesn't see the menu. */
  canManageColumns?: boolean;
  onAddColumn?: (type: FieldType) => void;
  /** How many column sorts are on, and the way to switch them all off. */
  sortCount?: number;
  onClearSorts?: () => void;
}) {
  return (
    <div class="flex items-center gap-1">
      <Show when={props.isCustom && (props.sortCount ?? 0) > 0}>
        <button
          type="button"
          onClick={() => props.onClearSorts?.()}
          class={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-primary transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft",
            focusRing,
          )}
        >
          <IconX aria-hidden="true" class="size-4" />
          Clear sorts
          <span class="font-mono tabular-nums">/ {props.sortCount}</span>
        </button>
      </Show>
      <Show
        when={props.isCustom && props.canManageColumns && props.onAddColumn}
      >
        <NewColumnMenu
          count={props.addedColumns ?? 0}
          onAdd={(type) => props.onAddColumn?.(type)}
        />
      </Show>
      <Show when={props.isCustom && props.onCreateSection}>
        <button
          type="button"
          disabled={!props.canCreateSection}
          onClick={() => props.onCreateSection?.()}
          class={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text disabled:cursor-not-allowed disabled:opacity-60",
            focusRing,
          )}
        >
          <IconPlus aria-hidden="true" class="size-4" />
          New section
        </button>
      </Show>
      <div class="hidden md:block">
        <AddColumnAction columns={props.columns} onChange={props.onChange} />
      </div>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────

export function TaskTable(props: TableProps) {
  /** Collapsed group keys: survive re-grouping, refetches and edits. */
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  /** Tasks whose subtasks are showing. */
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  function toggle(key: string) {
    setCollapsed((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expand(task: Task) {
    setExpanded((ids) => {
      const next = new Set(ids);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }

  // A getter-backed view of the props plus the table's own state, so each
  // group reads fresh values without the whole table re-rendering.
  const state: TableState = {
    get groups() {
      return props.groups;
    },
    get subtasks() {
      return props.subtasks;
    },
    get now() {
      return props.now;
    },
    get movingId() {
      return props.movingId;
    },
    get canCreate() {
      return props.canCreate;
    },
    canEdit: (task) => props.canEdit(task),
    onOpen: (task) => props.onOpen(task),
    onStatus: (task, column) => props.onStatus(task, column),
    onDelete: (task) => props.onDelete(task),
    onQuickAdd: (group, title) => props.onQuickAdd(group, title),
    onAddSubtask: (parent, title) => props.onAddSubtask(parent, title),
    get members() {
      return props.members;
    },
    onEdit: (task, patch) => props.onEdit(task, patch),
    get isCustom() {
      return props.isCustom;
    },
    onCreateSection: () => props.onCreateSection?.(),
    onRenameSection: (group, title) => props.onRenameSection?.(group, title),
    onDeleteSection: (group) => props.onDeleteSection?.(group),
    onMoveToSection: (task, sectionId) =>
      props.onMoveToSection?.(task, sectionId),
    get columns() {
      return props.columns;
    },
    get headings() {
      return props.headings;
    },
    onRenameHeading: (field, title) => props.onRenameHeading(field, title),
    get customColumns() {
      return props.isCustom ? props.customColumns : [];
    },
    get canManageColumns() {
      return props.canManageColumns;
    },
    get columnSorts() {
      return props.columnSorts;
    },
    onSort: (key, dir, mode) => props.onSort(key, dir, mode),
    onRemoveSort: (key) => props.onRemoveSort(key),
    onClearSorts: () => props.onClearSorts(),
    onInsertColumn: (type, placement) => props.onInsertColumn(type, placement),
    onDuplicateColumn: (column) => props.onDuplicateColumn(column),
    onChangeColumnType: (column, type) =>
      props.onChangeColumnType(column, type),
    onMoveColumn: (column, direction) => props.onMoveColumn(column, direction),
    onClearColumn: (column) => props.onClearColumn(column),
    onHideColumn: (field) => props.onHideColumn(field),
    get fieldValues() {
      return props.fieldValues;
    },
    onAddColumn: (type) => props.onAddColumn(type),
    onRenameColumn: (id, title) => props.onRenameColumn(id, title),
    onDeleteColumn: (column) => props.onDeleteColumn(column),
    onFieldChange: (task, column, value) =>
      props.onFieldChange(task, column, value),
    get expanded() {
      return expanded();
    },
    onExpand: expand,
  };

  // Groups are rebuilt from the task list on every change. Keying the loop
  // on their string keys (not the objects) keeps each group's DOM — and the
  // "Add task" field someone is typing into — alive across those rebuilds.
  const keys = () => props.groups.map((g) => g.key);

  return (
    <EditContext.Provider value={state}>
      <div class="flex flex-col gap-5">
        <For each={keys()}>
          {(key) => {
            const group = () => props.groups.find((g) => g.key === key);
            return (
              <Show when={group()}>
                {(g) => (
                  <TaskGroupTable
                    group={g()}
                    open={!collapsed().has(key)}
                    onToggle={() => toggle(key)}
                    table={state}
                  />
                )}
              </Show>
            );
          }}
        </For>
      </div>
    </EditContext.Provider>
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
