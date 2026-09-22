import { Dialog } from "@ark-ui/solid/dialog";
import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCalendarEvent,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconEqual,
  IconExternalLink,
  IconFlag,
  IconGripVertical,
  IconLock,
  IconMapPin,
  IconPlayerPause,
  IconPlus,
  IconProgress,
  IconTrash,
  IconUrgent,
  IconVideo,
  IconX,
} from "@tabler/icons-solidjs";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { TeamMember } from "~/components/app/context";
import { focusRing, inputBase, labelClass } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  SelectField,
  Spinner,
} from "~/components/onboarding/ui";
import {
  busiest,
  COLUMN_LABEL,
  COLUMNS,
  dueLabel,
  isOverdue,
  loadLabel,
  type MeetingDraft,
  meetingWhen,
  moveAnnouncement,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  type Task,
  type TaskColumn,
  type TaskDraft,
  type TaskPriority,
  type TeamMeeting,
  taskCountLabel,
  type Viewer,
  type WorkloadRow,
} from "~/components/tasks/data";
import { cn } from "~/lib/cn";

/**
 * Task board widgets (spec §6, `/collaborations/tasks`): a kanban with the
 * Kanban Card Drag interaction from §4.4, a workload bar per employee, and the
 * team's own meetings.
 *
 * Priority, due date and permission all read as an icon plus a word — never
 * colour alone (spec §1 anti-pattern 4). Every drag has a keyboard equal.
 */

export const cardClass =
  "rounded-lg border border-border bg-surface p-4 md:p-5";

const chipClass =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── Chips ───────────────────────────────────────────────────────────────

const PRIORITY_ICON: Record<TaskPriority, typeof IconFlag> = {
  high: IconUrgent,
  medium: IconEqual,
  low: IconFlag,
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  high: "bg-error/10 text-error",
  medium: "bg-primary-soft text-primary",
  low: "bg-background text-text-muted",
};

export function PriorityChip(props: { priority: TaskPriority }) {
  return (
    <span class={cn(chipClass, PRIORITY_TONE[props.priority])}>
      <Dynamic icon={PRIORITY_ICON[props.priority]} />
      {PRIORITY_LABEL[props.priority]}
      <span class="sr-only"> priority</span>
    </span>
  );
}

/** Chips are icon + word, so a colour is never the only signal. */
function Dynamic(props: { icon: typeof IconFlag }) {
  return <props.icon aria-hidden="true" class="size-3.5 shrink-0" />;
}

export function DueChip(props: { task: Task; now: Date }) {
  const label = () => dueLabel(props.task, props.now);
  const late = () => isOverdue(props.task, props.now);
  return (
    <Show when={label()}>
      {(text) => (
        <span
          class={cn(
            chipClass,
            late() ? "bg-error/10 text-error" : "bg-background text-text-muted",
          )}
        >
          <Dynamic icon={late() ? IconAlertTriangle : IconCalendarDue} />
          {text()}
        </span>
      )}
    </Show>
  );
}

export const COLUMN_ICON: Record<TaskColumn, typeof IconFlag> = {
  todo: IconFlag,
  in_progress: IconProgress,
  waiting: IconPlayerPause,
  done: IconCircleCheck,
};

/** Square mark for the assignee: their photo, else their initial. */
export function AssigneeMark(props: {
  member: { name: string; image: string | null } | null;
  class?: string;
}) {
  const name = () => props.member?.name ?? "Unassigned";
  return (
    <Show
      when={props.member?.image}
      fallback={
        <span
          aria-hidden="true"
          class={cn(
            "grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary",
            props.class,
          )}
        >
          {name().charAt(0).toUpperCase()}
        </span>
      }
    >
      {(src) => (
        <img
          src={src()}
          alt=""
          class={cn("size-7 shrink-0 rounded-full object-cover", props.class)}
        />
      )}
    </Show>
  );
}

// ─── Task card ───────────────────────────────────────────────────────────

const HELD_HINT =
  "Use the arrow keys to move it, Space to drop it, Escape to cancel.";

type CardProps = {
  task: Task;
  now: Date;
  /** False for a member looking at someone else's task (spec §6). */
  editable: boolean;
  /** Mid-flight: the move is saving, so the card greys out. */
  busy?: boolean;
  /** Picked up with the keyboard — lifted, and following the arrow keys. */
  held?: boolean;
  /** The board's one move hint; every grip points at the same element. */
  hintId?: string;
  onOpen: (task: Task) => void;
  onGrab?: (task: Task, event: PointerEvent, handle: HTMLElement) => void;
  onHandleKeyDown?: (task: Task, event: KeyboardEvent) => void;
};

/**
 * One card. The whole card opens the task; the grip is the only drag surface,
 * so a touch drag can never be mistaken for a scroll.
 */
export function TaskCard(props: CardProps) {
  return (
    <li
      data-task-id={props.task.id}
      class={cn(
        "flex gap-2 rounded-lg border bg-surface p-3",
        props.held
          ? "border-primary shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:scale-[1.02]"
          : "border-border",
        props.busy && "opacity-60",
        "transition-[box-shadow,border-color,scale] duration-[var(--duration-fast)] motion-reduce:transition-none",
      )}
    >
      <Show
        when={props.editable}
        fallback={
          <span
            class="mt-0.5 grid size-6 shrink-0 place-items-center text-text-muted"
            title="Only the assignee, an admin, or the owner can change this task"
          >
            <IconLock aria-hidden="true" class="size-4" />
            <span class="sr-only">Locked — assigned to someone else</span>
          </span>
        }
      >
        <button
          type="button"
          aria-label={`Move ${props.task.title}`}
          aria-describedby={props.hintId}
          aria-pressed={props.held}
          class={cn(
            "mt-0.5 grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-text-muted",
            "hover:bg-primary-soft hover:text-primary active:cursor-grabbing",
            "transition-colors duration-[var(--duration-fast)]",
            props.held && "bg-primary-soft text-primary",
            focusRing,
          )}
          onPointerDown={(e) => props.onGrab?.(props.task, e, e.currentTarget)}
          onKeyDown={(e) => props.onHandleKeyDown?.(props.task, e)}
        >
          <IconGripVertical aria-hidden="true" class="size-4" />
        </button>
      </Show>

      <div class="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => props.onOpen(props.task)}
          class={cn(
            "block w-full rounded-sm text-left font-medium text-pretty text-text hover:text-primary",
            "transition-colors duration-[var(--duration-fast)]",
            focusRing,
          )}
        >
          {props.task.title}
          <span class="sr-only">
            {" "}
            — open task{props.editable ? "" : " (read only)"}
          </span>
        </button>

        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <PriorityChip priority={props.task.priority} />
          <DueChip task={props.task} now={props.now} />
        </div>

        <p class="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <AssigneeMark member={props.task.assignee} class="size-5" />
          <span class="truncate">
            {props.task.assignee?.name ?? "Unassigned"}
          </span>
        </p>
      </div>
    </li>
  );
}

/** The slot the card will drop into: outline only, never a solid block. */
function DropSlot(props: { height: number }) {
  return (
    <li
      aria-hidden="true"
      class="rounded-lg border-2 border-dashed border-border-strong bg-primary-soft/30 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[var(--duration-fast)]"
      style={{ height: `${Math.max(56, props.height)}px` }}
    />
  );
}

// ─── Board ───────────────────────────────────────────────────────────────

type DragState = {
  taskId: string;
  pointerId: number;
  /** Pointer offset inside the card, so the ghost sits under the finger. */
  dx: number;
  dy: number;
  width: number;
  x: number;
  y: number;
  height: number;
};

/** Where a card would land, in the filtered list the board is showing. */
type Slot = { column: TaskColumn; index: number };

export function Board(props: {
  /** Already filtered and in board order. */
  columns: Record<TaskColumn, Task[]>;
  viewer: Viewer | undefined;
  now: Date;
  /** Per-column move failures (spec §4.4). */
  errors: Partial<Record<TaskColumn, string>>;
  /** Task id whose move is still saving. */
  movingId: string | null;
  /** Task id that just snapped back, so its return gets the slower 240ms. */
  revertedId: string | null;
  canEdit: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onCreate: (column: TaskColumn) => void;
  /** `beforeId` is the card to drop in front of; null means the end. */
  onMove: (taskId: string, column: TaskColumn, beforeId: string | null) => void;
  announce: (message: string) => void;
}) {
  const [drag, setDrag] = createSignal<DragState | null>(null);
  const [target, setTarget] = createSignal<Slot | null>(null);
  /** Keyboard pick-up: the card stays in the list and hops as arrows fire. */
  const [held, setHeld] = createSignal<({ taskId: string } & Slot) | null>(
    null,
  );
  /** Below `md` one column shows at a time; a full kanban never fits a phone. */
  const [mobileColumn, setMobileColumn] = createSignal<TaskColumn>("todo");

  const hintId = createUniqueId();
  let root: HTMLDivElement | undefined;
  const lists: Partial<Record<TaskColumn, HTMLUListElement>> = {};

  const draggingId = () => drag()?.taskId ?? null;

  /**
   * What each column renders. A pointer-dragged card leaves the flow (the
   * ghost carries it); a keyboard-held card stays put and is previewed in its
   * new slot, because its owner has to be able to see what they are moving.
   */
  const view = createMemo<Record<TaskColumn, Task[]>>(() => {
    const id = draggingId();
    if (id) {
      return {
        todo: props.columns.todo.filter((t) => t.id !== id),
        in_progress: props.columns.in_progress.filter((t) => t.id !== id),
        waiting: props.columns.waiting.filter((t) => t.id !== id),
        done: props.columns.done.filter((t) => t.id !== id),
      };
    }

    const grab = held();
    if (!grab) return props.columns;

    const next: Record<TaskColumn, Task[]> = {
      todo: [...props.columns.todo],
      in_progress: [...props.columns.in_progress],
      waiting: [...props.columns.waiting],
      done: [...props.columns.done],
    };
    for (const column of COLUMNS) {
      const at = next[column.value].findIndex((t) => t.id === grab.taskId);
      if (at !== -1) {
        const [task] = next[column.value].splice(at, 1);
        next[grab.column].splice(
          Math.min(grab.index, next[grab.column].length),
          0,
          task,
        );
        break;
      }
    }
    return next;
  });

  const slot = () => (drag() ? target() : null);

  // ── Sliding (spec §4.4: siblings slide, a failed move returns) ─────────
  //
  // FLIP: positions are measured after every settled render, so the next
  // change can animate from where each card used to be. Styles are set
  // through the CSSOM rather than a `style` attribute, which keeps the
  // enforcing CSP free of `'unsafe-inline'` (spec §5, Key Risks 4).
  let seen = new Map<string, { left: number; top: number }>();

  function slide() {
    const container = root;
    if (!container) return;

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-task-id]"),
    );
    const next = new Map<string, { left: number; top: number }>();
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      next.set(node.dataset.taskId ?? "", { left: box.left, top: box.top });
    }

    if (!reducedMotion()) {
      const moved: Array<[HTMLElement, number]> = [];
      for (const node of nodes) {
        const id = node.dataset.taskId ?? "";
        const from = seen.get(id);
        const to = next.get(id);
        if (!from || !to) continue;
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (dx === 0 && dy === 0) continue;
        node.style.transition = "none";
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        moved.push([node, id === props.revertedId ? 240 : 200]);
      }
      if (moved.length > 0) {
        requestAnimationFrame(() => {
          for (const [node, duration] of moved) {
            node.style.transition = `transform ${duration}ms var(--ease-in-out)`;
            node.style.transform = "";
          }
        });
      }
    }

    seen = next;
  }

  createEffect(
    on(
      () => [view(), slot(), props.errors] as const,
      () => slide(),
    ),
  );

  // ── Pointer drag ──────────────────────────────────────────────────────

  /** The column under the pointer, and the gap the card would take in it. */
  function slotAt(x: number, y: number, taskId: string): Slot | null {
    for (const column of COLUMNS) {
      const list = lists[column.value];
      if (!list) continue;
      const box = list.getBoundingClientRect();
      if (x < box.left || x > box.right) continue;

      const cards = Array.from(
        list.querySelectorAll<HTMLElement>("[data-task-id]"),
      ).filter((card) => card.dataset.taskId !== taskId);

      let index = cards.length;
      for (let i = 0; i < cards.length; i += 1) {
        const rect = cards[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      return { column: column.value, index };
    }
    return null;
  }

  function startDrag(task: Task, event: PointerEvent, handle: HTMLElement) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (held()) return;

    const card = handle.closest<HTMLElement>("[data-task-id]");
    if (!card) return;
    const box = card.getBoundingClientRect();

    // No `setPointerCapture` here: capture would retarget every later
    // pointer event to this button, and the move and drop listeners live on
    // the window so a drag survives leaving the column — or the page.
    event.preventDefault();

    batch(() => {
      setDrag({
        taskId: task.id,
        pointerId: event.pointerId,
        dx: event.clientX - box.left,
        dy: event.clientY - box.top,
        width: box.width,
        height: box.height,
        x: event.clientX,
        y: event.clientY,
      });
      setTarget(slotAt(event.clientX, event.clientY, task.id));
    });
  }

  function onPointerMove(event: PointerEvent) {
    const state = drag();
    if (!state || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    batch(() => {
      setDrag({ ...state, x: event.clientX, y: event.clientY });
      const next = slotAt(event.clientX, event.clientY, state.taskId);
      if (next) setTarget(next);
    });
  }

  function endDrag(event: PointerEvent, commit: boolean) {
    const state = drag();
    if (!state || event.pointerId !== state.pointerId) return;
    const landing = target();

    batch(() => {
      setDrag(null);
      setTarget(null);
    });

    if (!commit || !landing) return;
    props.onMove(
      state.taskId,
      landing.column,
      view()[landing.column][landing.index]?.id ?? null,
    );
  }

  // ── Keyboard move (spec §4.4) ─────────────────────────────────────────

  function locateIn(taskId: string): Slot | null {
    for (const column of COLUMNS) {
      const index = props.columns[column.value].findIndex(
        (t) => t.id === taskId,
      );
      if (index !== -1) return { column: column.value, index };
    }
    return null;
  }

  function announceSlot(next: Slot) {
    const total = view()[next.column].length;
    props.announce(moveAnnouncement(next.column, next.index, total));
  }

  function onHandleKeyDown(task: Task, event: KeyboardEvent) {
    const grab = held();

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!grab) {
        const at = locateIn(task.id);
        if (!at) return;
        setHeld({ taskId: task.id, ...at });
        props.announce(`Picked up ${task.title}. ${HELD_HINT}`);
        return;
      }
      setHeld(null);
      props.onMove(
        grab.taskId,
        grab.column,
        // The preview already has the card in place, so the card after it is
        // what the server needs to insert before.
        view()[grab.column][grab.index + 1]?.id ?? null,
      );
      props.announce(`Dropped ${task.title} in ${COLUMN_LABEL[grab.column]}`);
      return;
    }

    if (!grab) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setHeld(null);
      props.announce(`Move cancelled. ${task.title} stayed where it was.`);
      return;
    }

    const columnAt = COLUMNS.findIndex((c) => c.value === grab.column);
    let next: Slot | null = null;

    switch (event.key) {
      case "ArrowLeft":
        if (columnAt > 0) {
          next = { column: COLUMNS[columnAt - 1].value, index: grab.index };
        }
        break;
      case "ArrowRight":
        if (columnAt < COLUMNS.length - 1) {
          next = { column: COLUMNS[columnAt + 1].value, index: grab.index };
        }
        break;
      case "ArrowUp":
        if (grab.index > 0) next = { ...grab, index: grab.index - 1 };
        break;
      case "ArrowDown":
        next = { ...grab, index: grab.index + 1 };
        break;
      default:
        return;
    }

    event.preventDefault();
    if (!next) return;

    // The held card is counted in its own column, so the last slot differs
    // depending on whether it is already there.
    const size = props.columns[next.column].filter(
      (t) => t.id !== grab.taskId,
    ).length;
    const index = Math.max(0, Math.min(next.index, size));

    setHeld({ taskId: grab.taskId, column: next.column, index });
    setMobileColumn(next.column);
    announceSlot({ column: next.column, index });
  }

  // Move and drop are watched on the window, so a drag that wanders out of
  // the board — or off the page — still lands or cancels cleanly.
  createEffect(() => {
    if (!drag()) return;
    const move = (event: PointerEvent) => onPointerMove(event);
    const drop = (event: PointerEvent) => endDrag(event, true);
    const cancel = (event: PointerEvent) => endDrag(event, false);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", cancel);
    onCleanup(() => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", cancel);
    });
  });

  // Leaving the page mid-drag would otherwise leave a stuck ghost behind.
  onCleanup(() => {
    setDrag(null);
    setTarget(null);
  });

  const heldTask = () => {
    const grab = held();
    if (!grab) return null;
    return (
      Object.values(props.columns)
        .flat()
        .find((t) => t.id === grab.taskId) ?? null
    );
  };

  const dragTask = () => {
    const id = draggingId();
    if (!id) return null;
    return (
      Object.values(props.columns)
        .flat()
        .find((t) => t.id === id) ?? null
    );
  };

  return (
    <>
      {/* Column picker for phones: a four-column kanban cannot be read on
          one, and a horizontally scrolling board hides the other columns
          (spec §1 anti-pattern 5). */}
      <div
        role="tablist"
        aria-label="Board column"
        class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:hidden"
      >
        <For each={COLUMNS}>
          {(column) => {
            const active = () => mobileColumn() === column.value;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active()}
                onClick={() => setMobileColumn(column.value)}
                class={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
                  "transition-colors duration-[var(--duration-fast)]",
                  active()
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong text-text-muted",
                  focusRing,
                )}
              >
                <Dynamic icon={COLUMN_ICON[column.value]} />
                {column.label}
                <span class="font-mono tabular-nums">
                  {props.columns[column.value].length}
                </span>
              </button>
            );
          }}
        </For>
      </div>

      {/* One hint for the whole board: repeating it inside every card would
          make a screen reader read it once per task. */}
      <span id={hintId} class="sr-only">
        Press Space to pick this task up. {HELD_HINT}
      </span>

      <div ref={root} class="grid gap-4 md:grid-cols-4 md:items-start">
        <For each={COLUMNS}>
          {(column) => {
            const items = () => view()[column.value];
            const here = () => {
              const s = slot();
              return s?.column === column.value ? s.index : null;
            };
            const error = () => props.errors[column.value];

            return (
              <section
                aria-labelledby={`column-${column.value}`}
                class={cn(
                  "min-w-0 flex-col gap-3 rounded-lg border border-border bg-background/60 p-3",
                  mobileColumn() === column.value ? "flex" : "hidden md:flex",
                )}
              >
                <div class="flex items-center justify-between gap-2">
                  <h3
                    id={`column-${column.value}`}
                    class="flex min-w-0 items-center gap-1.5 font-display text-sm font-semibold text-text"
                  >
                    <Dynamic icon={COLUMN_ICON[column.value]} />
                    <span class="truncate">{column.label}</span>
                    <span class="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary">
                      {props.columns[column.value].length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    aria-label={`Add a task to ${column.label}`}
                    onClick={() => props.onCreate(column.value)}
                    class={cn(
                      "grid size-9 shrink-0 place-items-center rounded-md text-text-muted",
                      "hover:bg-primary-soft hover:text-primary",
                      "transition-colors duration-[var(--duration-fast)]",
                      focusRing,
                    )}
                  >
                    <IconPlus aria-hidden="true" class="size-4" />
                  </button>
                </div>

                <Show when={error()}>
                  {(message) => <Notice tone="error">{message()}</Notice>}
                </Show>

                <ul
                  ref={(el) => {
                    lists[column.value] = el;
                  }}
                  class="flex min-h-16 flex-col gap-2"
                >
                  <For each={items()}>
                    {(task, i) => (
                      <>
                        <Show when={here() === i()}>
                          <DropSlot height={drag()?.height ?? 0} />
                        </Show>
                        <TaskCard
                          task={task}
                          now={props.now}
                          editable={props.canEdit(task)}
                          busy={props.movingId === task.id}
                          held={held()?.taskId === task.id}
                          hintId={hintId}
                          onOpen={props.onOpen}
                          onGrab={startDrag}
                          onHandleKeyDown={onHandleKeyDown}
                        />
                      </>
                    )}
                  </For>
                  <Show when={here() !== null && here()! >= items().length}>
                    <DropSlot height={drag()?.height ?? 0} />
                  </Show>

                  <Show when={items().length === 0 && here() === null}>
                    <li class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
                      {column.lead}
                    </li>
                  </Show>
                </ul>
              </section>
            );
          }}
        </For>
      </div>

      {/* The lifted card, following the pointer. */}
      <Show when={drag()}>
        {(state) => (
          <Portal>
            <div
              aria-hidden="true"
              class="pointer-events-none fixed top-0 left-0 z-50 rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.12)] motion-safe:scale-[1.02]"
              style={{
                width: `${state().width}px`,
                transform: `translate(${state().x - state().dx}px, ${
                  state().y - state().dy
                }px)`,
              }}
            >
              <Show when={dragTask()}>
                {(task) => (
                  <ul>
                    <TaskCard
                      task={task()}
                      now={props.now}
                      editable={false}
                      onOpen={() => {}}
                    />
                  </ul>
                )}
              </Show>
            </div>
          </Portal>
        )}
      </Show>

      {/* A shield over the page while a card is in the air: it holds the
          grabbing cursor, stops text selection, and keeps a touch drag from
          scrolling the board out from under the finger. */}
      <Show when={drag()}>
        <Portal>
          <div
            aria-hidden="true"
            class="fixed inset-0 z-40 cursor-grabbing touch-none select-none"
          />
        </Portal>
      </Show>

      <Show when={heldTask()}>
        {(task) => (
          <p class="mt-3 flex items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary">
            <IconGripVertical aria-hidden="true" class="size-4 shrink-0" />
            <span>
              Moving <span class="font-medium">{task().title}</span>.{" "}
              {HELD_HINT}
            </span>
          </p>
        )}
      </Show>
    </>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-busy="true" class="grid gap-4 md:grid-cols-4 md:items-start">
      <span class="sr-only">Loading the board…</span>
      <For each={COLUMNS}>
        {(_column, i) => (
          <div
            class={cn(
              "rounded-lg border border-border bg-background/60 p-3",
              i() > 0 && "hidden md:block",
            )}
          >
            <Skeleton class="h-5 w-28" />
            <div class="mt-3 flex flex-col gap-2">
              <For each={Array.from({ length: 3 - (i() % 2) })}>
                {() => (
                  <div class="rounded-lg border border-border bg-surface p-3">
                    <Skeleton class="h-4 w-4/5" />
                    <Skeleton class="mt-2 h-5 w-24 rounded-full opacity-70" />
                    <Skeleton class="mt-2 h-4 w-1/2 opacity-70" />
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Task dialog ─────────────────────────────────────────────────────────

const dialogBackdrop =
  "fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0";
const dialogPositioner =
  "fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center";
const dialogContent =
  "max-h-[calc(100dvh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-lg bg-surface p-6 text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95";

/**
 * Label, control and hint as one block. The id is generated here and handed
 * back, so every control keeps a real `for` pairing rather than relying on
 * being nested inside the label.
 */
function Field(props: {
  label: string;
  hint?: string;
  children: (id: string) => JSX.Element;
}) {
  const id = createUniqueId();
  const hintId = `${id}-hint`;
  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class={labelClass}>
        {props.label}
      </label>
      {props.children(id)}
      <Show when={props.hint}>
        <span id={hintId} class="text-sm text-text-muted">
          {props.hint}
        </span>
      </Show>
    </div>
  );
}

/**
 * Create and edit share one form: the fields are the same, and an owner
 * moving a task from a phone does it here rather than by dragging.
 */
export function TaskDialog(props: {
  open: boolean;
  /** Absent when creating. */
  task: Task | null;
  draft: TaskDraft;
  members: TeamMember[];
  /** Read-only for a member looking at someone else's task. */
  editable: boolean;
  pending: boolean;
  error: string;
  onChange: (next: Partial<TaskDraft>) => void;
  onSubmit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const memberOptions = () =>
    [...props.members]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name, description: m.email }));

  const columnOptions = COLUMNS.map((c) => ({
    value: c.value,
    label: c.label,
    description: c.lead,
  }));

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class={dialogBackdrop} />
        <Dialog.Positioner class={dialogPositioner}>
          <Dialog.Content class={dialogContent}>
            <Dialog.Title class="font-display text-lg font-semibold">
              {props.task ? "Task" : "New task"}
            </Dialog.Title>
            <Dialog.Description class="mt-1 text-sm text-text-muted">
              <Show
                when={props.editable}
                fallback="This task is assigned to someone else, so only they, an admin, or the owner can change it."
              >
                Everything here can change later — drag the card on the board,
                or come back and edit it.
              </Show>
            </Dialog.Description>

            <form
              class="mt-5 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                props.onSubmit();
              }}
            >
              <fieldset
                disabled={!props.editable}
                class="flex flex-col gap-4 disabled:opacity-90"
              >
                <Field label="Title">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      maxlength={160}
                      value={props.draft.title}
                      placeholder="Reply to this week's Google reviews"
                      onInput={(e) =>
                        props.onChange({ title: e.currentTarget.value })
                      }
                      class={inputBase}
                    />
                  )}
                </Field>

                <Field
                  label="Details"
                  hint="Optional — anything the assignee needs to know."
                >
                  {(id) => (
                    <textarea
                      id={id}
                      rows={3}
                      value={props.draft.description}
                      onInput={(e) =>
                        props.onChange({ description: e.currentTarget.value })
                      }
                      class={cn(
                        inputBase,
                        "min-h-24 resize-y py-2 leading-relaxed",
                      )}
                    />
                  )}
                </Field>

                <SelectField
                  label="Assigned to"
                  options={memberOptions()}
                  value={props.draft.assigneeId}
                  onChange={(assigneeId) => props.onChange({ assigneeId })}
                  placeholder="Choose a team member"
                />

                <div class="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Column"
                    options={columnOptions}
                    value={props.draft.column}
                    onChange={(column) =>
                      props.onChange({ column: column as TaskColumn })
                    }
                  />
                  <SelectField
                    label="Priority"
                    options={PRIORITY_OPTIONS}
                    value={props.draft.priority}
                    onChange={(priority) =>
                      props.onChange({ priority: priority as TaskPriority })
                    }
                  />
                </div>

                <Field
                  label="Due date"
                  hint="Leave empty if there is no deadline."
                >
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={props.draft.dueDate}
                      onInput={(e) =>
                        props.onChange({ dueDate: e.currentTarget.value })
                      }
                      class={inputBase}
                    />
                  )}
                </Field>
              </fieldset>

              <Show when={props.error}>
                {(error) => <Notice tone="error">{error()}</Notice>}
              </Show>

              <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Show
                  when={props.editable && props.task}
                  fallback={<span class="hidden sm:block" />}
                >
                  <button
                    type="button"
                    onClick={() => props.onDelete()}
                    class={cn(
                      btnSecondary,
                      "min-h-11 border-error/40 px-4 text-sm text-error hover:bg-error/5",
                    )}
                  >
                    <IconTrash aria-hidden="true" class="size-4" />
                    Delete
                  </button>
                </Show>

                <div class="flex flex-col-reverse gap-2 sm:flex-row">
                  <Dialog.CloseTrigger
                    class={cn(btnSecondary, "min-h-11 px-4 text-sm")}
                  >
                    {props.editable ? "Cancel" : "Close"}
                  </Dialog.CloseTrigger>
                  <Show when={props.editable}>
                    <button
                      type="submit"
                      disabled={props.pending || !props.draft.title.trim()}
                      class={cn(
                        btnPrimary,
                        "min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60",
                      )}
                    >
                      <Show when={props.pending}>
                        <Spinner class="size-4" />
                      </Show>
                      {props.task ? "Save task" : "Create task"}
                    </button>
                  </Show>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** Deleting a task cannot be undone from here, so it confirms first. */
export function DeleteTaskDialog(props: {
  task: Task | null;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={Boolean(props.task)}
      role="alertdialog"
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class={dialogBackdrop} />
        <Dialog.Positioner class={dialogPositioner}>
          <Dialog.Content class={cn(dialogContent, "max-w-[440px]")}>
            <span class="grid size-11 place-items-center rounded-full bg-error/10 text-error">
              <IconAlertTriangle aria-hidden="true" class="size-5" />
            </span>
            <Dialog.Title class="mt-4 font-display text-lg font-semibold">
              Delete this task?
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-base text-text-muted">
              <span class="font-medium text-text">{props.task?.title}</span>{" "}
              will be removed from the board for everyone. This can't be undone.
            </Dialog.Description>

            <Show when={props.error}>
              {(error) => (
                <div class="mt-4">
                  <Notice tone="error">{error()}</Notice>
                </div>
              )}
            </Show>

            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.CloseTrigger class={cn(btnSecondary, "min-h-11")}>
                Keep it
              </Dialog.CloseTrigger>
              <button
                type="button"
                disabled={props.pending}
                onClick={() => props.onConfirm()}
                class={cn(
                  btnPrimary,
                  "min-h-11 bg-error text-surface disabled:cursor-progress disabled:opacity-80",
                )}
              >
                <Show when={props.pending}>
                  <Spinner class="size-4" />
                </Show>
                Delete task
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Workload ────────────────────────────────────────────────────────────

/**
 * One bar per employee (spec §6). The count carries the meaning and the bar
 * only repeats it, so the view survives without colour.
 */
export function WorkloadPanel(props: { rows: WorkloadRow[] }) {
  const max = () => busiest(props.rows);

  return (
    <ul class="flex flex-col gap-3">
      <For each={props.rows}>
        {(row) => (
          <li class={cardClass}>
            <div class="flex items-start gap-3">
              <AssigneeMark member={row.member} class="size-10" />
              <div class="min-w-0 flex-1">
                <h3 class="truncate font-display text-base font-semibold text-text">
                  {row.member.name}
                </h3>
                <p class="truncate text-sm text-text-muted">
                  {row.member.email}
                </p>
              </div>
              <span
                class={cn(
                  chipClass,
                  row.overdue > 0
                    ? "bg-error/10 text-error"
                    : "bg-background text-text-muted",
                )}
              >
                <Dynamic
                  icon={row.overdue > 0 ? IconAlertTriangle : IconProgress}
                />
                {loadLabel(row)}
              </span>
            </div>

            <p class="mt-3 flex items-baseline gap-2">
              <span class="font-mono text-xl font-medium tabular-nums text-text">
                {row.open}
              </span>
              <span class="text-sm text-text-muted">
                open {taskCountLabel(row.open)}
              </span>
            </p>

            <div
              aria-hidden="true"
              class="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft"
            >
              <div
                class={cn(
                  "h-full origin-left rounded-full transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none",
                  row.overdue > 0 ? "bg-accent" : "bg-primary",
                )}
                style={{ transform: `scaleX(${row.open / max()})` }}
              />
            </div>

            <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-muted">
              <span>
                <span class="font-mono tabular-nums">{row.high}</span> high
                priority
              </span>
              <span class={cn(row.overdue > 0 && "font-medium text-error")}>
                <span class="font-mono tabular-nums">{row.overdue}</span>{" "}
                overdue
              </span>
              <span>
                <span class="font-mono tabular-nums">{row.done}</span> done
              </span>
            </p>
          </li>
        )}
      </For>
    </ul>
  );
}

export function WorkloadSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-3">
      <span class="sr-only">Loading your team's workload…</span>
      <For each={Array.from({ length: 3 })}>
        {() => (
          <div class={cardClass}>
            <div class="flex items-start gap-3">
              <Skeleton class="size-10 shrink-0 rounded-full" />
              <div class="flex flex-1 flex-col gap-2">
                <Skeleton class="h-4 w-2/5" />
                <Skeleton class="h-3.5 w-3/5 opacity-70" />
              </div>
            </div>
            <Skeleton class="mt-4 h-6 w-24" />
            <Skeleton class="mt-3 h-1.5 w-full" />
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Team meetings ───────────────────────────────────────────────────────

/** Icon swaps Copy → Check for 2s; the button is the feedback, so no toast. */
export function CopyLinkButton(props: {
  value: string;
  label: string;
  copiedMessage: string;
  announce: (message: string) => void;
  onFailed: () => void;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      props.announce(props.copiedMessage);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onFailed();
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      class={cn(btnSecondary, "min-h-11 px-3 text-sm")}
    >
      <span class="relative grid size-4 place-items-center">
        <IconCopy
          aria-hidden="true"
          class={cn(
            "absolute size-4 transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
            copied() && "opacity-0",
          )}
        />
        <IconCheck
          aria-hidden="true"
          class={cn(
            "absolute size-4 text-success transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
            !copied() && "opacity-0",
          )}
        />
      </span>
      {copied() ? "Copied" : props.label}
    </button>
  );
}

export function MeetingCard(props: {
  meeting: TeamMeeting;
  past: boolean;
  pending: boolean;
  announce: (message: string) => void;
  onCancel: (meeting: TeamMeeting) => void;
  onCopyFailed: () => void;
}) {
  const m = () => props.meeting;
  return (
    <li
      class={cn(
        cardClass,
        "animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none",
        props.pending && "opacity-60",
        props.past && "opacity-80",
      )}
    >
      <div class="flex items-start gap-3">
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"
        >
          <IconCalendarEvent class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="font-display text-base font-semibold text-pretty text-text">
            {m().title}
          </h3>
          <p class="mt-0.5 font-mono text-sm tabular-nums text-text-muted">
            {meetingWhen(m())}
          </p>
        </div>
        <Show when={props.past}>
          <span class={cn(chipClass, "bg-background text-text-muted")}>
            <Dynamic icon={IconCircleCheck} />
            Finished
          </span>
        </Show>
      </div>

      <p class="mt-3 flex items-center gap-1.5 text-sm text-text-muted">
        <IconMapPin aria-hidden="true" class="size-4 shrink-0" />
        <span class="truncate">{m().location}</span>
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Show when={!props.past && m().meetUri}>
          {(uri) => (
            <>
              <a
                href={uri()}
                target="_blank"
                rel="noopener noreferrer"
                class={cn(btnPrimary, "min-h-11 px-4 text-sm")}
              >
                <IconVideo aria-hidden="true" class="size-4" />
                Join
                <IconExternalLink aria-hidden="true" class="size-3.5" />
                <span class="sr-only">(opens in a new tab)</span>
              </a>
              <CopyLinkButton
                value={uri()}
                label="Copy Meet link"
                copiedMessage={`Meet link for ${m().title} copied`}
                announce={props.announce}
                onFailed={props.onCopyFailed}
              />
            </>
          )}
        </Show>

        <Show when={!props.past && !m().meetUri}>
          <p class="flex items-center gap-1.5 text-sm text-text-muted">
            <IconVideo aria-hidden="true" class="size-4" />
            No Meet link — connect Google in Settings to get one automatically.
          </p>
        </Show>

        <button
          type="button"
          disabled={props.pending}
          onClick={() => props.onCancel(m())}
          class={cn(
            btnSecondary,
            "min-h-11 px-3 text-sm disabled:cursor-progress disabled:opacity-80",
          )}
        >
          <IconX aria-hidden="true" class="size-4" />
          {props.past ? "Remove" : "Cancel"}
        </button>
      </div>
    </li>
  );
}

export function MeetingsSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-3">
      <span class="sr-only">Loading your team's meetings…</span>
      <For each={Array.from({ length: 2 })}>
        {() => (
          <div class={cardClass}>
            <div class="flex items-start gap-3">
              <Skeleton class="size-10 shrink-0 rounded-md" />
              <div class="flex flex-1 flex-col gap-2">
                <Skeleton class="h-4 w-2/5" />
                <Skeleton class="h-3.5 w-3/5 opacity-70" />
              </div>
            </div>
            <Skeleton class="mt-4 h-11 w-40" />
          </div>
        )}
      </For>
    </div>
  );
}

/** Scheduling a team meeting: same shape as the partner scheduler's form. */
export function MeetingDialog(props: {
  open: boolean;
  draft: MeetingDraft;
  pending: boolean;
  error: string;
  onChange: (next: Partial<MeetingDraft>) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const invalidTimes = () =>
    Boolean(props.draft.startTime) &&
    Boolean(props.draft.endTime) &&
    props.draft.endTime <= props.draft.startTime;

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class={dialogBackdrop} />
        <Dialog.Positioner class={dialogPositioner}>
          <Dialog.Content class={dialogContent}>
            <span class="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
              <IconCalendarEvent aria-hidden="true" class="size-5" />
            </span>
            <Dialog.Title class="mt-4 font-display text-lg font-semibold">
              Schedule a team meeting
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-base text-text-muted">
              Everyone on your team sees it here. A Google Meet link is added
              automatically when your Google account is connected.
            </Dialog.Description>

            <form
              class="mt-5 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                props.onSubmit();
              }}
            >
              <Field label="Title">
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    required
                    maxlength={160}
                    value={props.draft.title}
                    placeholder="Monday stand-up"
                    onInput={(e) =>
                      props.onChange({ title: e.currentTarget.value })
                    }
                    class={inputBase}
                  />
                )}
              </Field>

              <Field label="Date">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    required
                    value={props.draft.date}
                    onInput={(e) =>
                      props.onChange({ date: e.currentTarget.value })
                    }
                    class={inputBase}
                  />
                )}
              </Field>

              <div class="grid gap-4 sm:grid-cols-2">
                <Field label="Starts">
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      required
                      value={props.draft.startTime}
                      onInput={(e) =>
                        props.onChange({ startTime: e.currentTarget.value })
                      }
                      class={inputBase}
                    />
                  )}
                </Field>
                <Field label="Ends">
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      required
                      value={props.draft.endTime}
                      aria-invalid={invalidTimes()}
                      onInput={(e) =>
                        props.onChange({ endTime: e.currentTarget.value })
                      }
                      class={inputBase}
                    />
                  )}
                </Field>
              </div>

              <Show when={invalidTimes()}>
                <Notice tone="warning">
                  The end time needs to be after the start time.
                </Notice>
              </Show>

              <Field
                label="Where"
                hint="A room, an address, or “Online” if it is a call."
              >
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    required
                    maxlength={160}
                    value={props.draft.location}
                    placeholder="Back office"
                    onInput={(e) =>
                      props.onChange({ location: e.currentTarget.value })
                    }
                    class={inputBase}
                  />
                )}
              </Field>

              <Show when={props.error}>
                {(error) => <Notice tone="error">{error()}</Notice>}
              </Show>

              <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.CloseTrigger
                  class={cn(btnSecondary, "min-h-11 px-4 text-sm")}
                >
                  Cancel
                </Dialog.CloseTrigger>
                <button
                  type="submit"
                  disabled={props.pending || invalidTimes()}
                  class={cn(
                    btnPrimary,
                    "min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <Show when={props.pending}>
                    <Spinner class="size-4" />
                  </Show>
                  Schedule meeting
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** Cancelling a meeting mails nobody, so it confirms before it disappears. */
export function CancelMeetingDialog(props: {
  meeting: TeamMeeting | null;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={Boolean(props.meeting)}
      role="alertdialog"
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class={dialogBackdrop} />
        <Dialog.Positioner class={dialogPositioner}>
          <Dialog.Content class={cn(dialogContent, "max-w-[440px]")}>
            <span class="grid size-11 place-items-center rounded-full bg-error/10 text-error">
              <IconAlertTriangle aria-hidden="true" class="size-5" />
            </span>
            <Dialog.Title class="mt-4 font-display text-lg font-semibold">
              Cancel this meeting?
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-base text-text-muted">
              <span class="font-medium text-text">{props.meeting?.title}</span>{" "}
              ·{" "}
              <span class="font-mono tabular-nums">
                {props.meeting ? meetingWhen(props.meeting) : ""}
              </span>
              <br />
              It disappears for the whole team. Nobody is emailed, so tell them
              yourself.
            </Dialog.Description>

            <Show when={props.error}>
              {(error) => (
                <div class="mt-4">
                  <Notice tone="error">{error()}</Notice>
                </div>
              )}
            </Show>

            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.CloseTrigger class={cn(btnSecondary, "min-h-11")}>
                Keep it
              </Dialog.CloseTrigger>
              <button
                type="button"
                disabled={props.pending}
                onClick={() => props.onConfirm()}
                class={cn(
                  btnPrimary,
                  "min-h-11 bg-error text-surface disabled:cursor-progress disabled:opacity-80",
                )}
              >
                <Show when={props.pending}>
                  <Spinner class="size-4" />
                </Show>
                Cancel meeting
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Shared section furniture ────────────────────────────────────────────

export function SectionHeading(props: {
  id: string;
  title: string;
  lead?: string;
  action?: JSX.Element;
}) {
  return (
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h2
          id={props.id}
          class="font-display text-lg font-semibold text-text md:text-xl"
        >
          {props.title}
        </h2>
        <Show when={props.lead}>
          <p class="mt-1 max-w-[60ch] text-sm text-pretty text-text-muted">
            {props.lead}
          </p>
        </Show>
      </div>
      <Show when={props.action}>{props.action}</Show>
    </div>
  );
}

/** Count badge in a tab, so the owner sees what is empty before opening it. */
export function TabCount(props: { value: number }) {
  return (
    <span class="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary">
      {props.value}
    </span>
  );
}

/** Board summary: what is open, what is late — in words, then numbers. */
export function BoardSummary(props: {
  open: number;
  overdue: number;
  showing: number;
  filtered: boolean;
}) {
  return (
    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
      <Switch>
        <Match when={props.open === 0}>Nothing open right now.</Match>
        <Match when={true}>
          <span>
            <span class="font-mono tabular-nums">{props.open}</span> open{" "}
            {taskCountLabel(props.open)}
          </span>
          <Show when={props.overdue > 0}>
            <span class="font-medium text-error">
              · <span class="font-mono tabular-nums">{props.overdue}</span>{" "}
              overdue
            </span>
          </Show>
        </Match>
      </Switch>
      <Show when={props.filtered}>
        <span>
          · showing <span class="font-mono tabular-nums">{props.showing}</span>
        </span>
      </Show>
    </p>
  );
}
