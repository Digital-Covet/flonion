import {
  IconArrowDown,
  IconArrowUp,
  IconGripVertical,
} from "@tabler/icons-solidjs";
import {
  type Accessor,
  createSignal,
  createUniqueId,
  For,
  type JSX,
} from "solid-js";
import { focusRing } from "~/components/auth/AuthShell";
import { moveItem } from "~/components/company/data";
import { Skeleton } from "~/components/dashboard/ui";
import { cn } from "~/lib/cn";

/**
 * Portfolio manager pieces for `/marketplace/projects`.
 *
 * The public profile renders the same rows read-only, so everything here is
 * the ordering layer on top of them. Order is what the owner is really editing
 * on this page: every section is read back `position` ascending, so moving a
 * service up is what puts it in front of a partner first.
 */

// ─── Tabs ────────────────────────────────────────────────────────────────

export const tabListClass =
  "relative flex gap-1 overflow-x-auto border-b border-border";

/**
 * 44px targets with the active tab underlined rather than filled, so the three
 * sections read as one strip instead of three buttons.
 */
export const tabTriggerClass = cn(
  "relative flex min-h-11 shrink-0 items-center gap-2 rounded-t-sm px-3 text-sm font-medium whitespace-nowrap text-text-muted",
  "transition-colors duration-[var(--duration-fast)] hover:text-text",
  "data-[selected]:text-primary",
  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[selected]:after:bg-primary",
  focusRing,
);

/** Count badge in a tab, so the owner sees what is empty before opening it. */
export function TabCount(props: { value: number }) {
  return (
    <span class="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary">
      {props.value}
    </span>
  );
}

/** Title, one line of guidance, and the section's "Add …" button. */
export function PanelHeader(props: {
  id: string;
  title: string;
  lead: string;
  action: JSX.Element;
}) {
  return (
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id={props.id} class="font-display text-lg font-semibold text-text">
          {props.title}
        </h2>
        <p class="mt-1 max-w-[60ch] text-sm text-pretty text-text-muted">
          {props.lead}
        </p>
      </div>
      {props.action}
    </div>
  );
}

// ─── Reordering ──────────────────────────────────────────────────────────

const controlClass = cn(
  "grid size-9 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)]",
  "hover:bg-primary-soft hover:text-text",
  "aria-disabled:pointer-events-none aria-disabled:opacity-40",
  "disabled:cursor-progress disabled:opacity-60",
  focusRing,
);

/** The list owns the `ul`, so a row's index is just its DOM position. */
function indexOfRow(list: HTMLUListElement, node: Element | null): number {
  if (!node) return -1;
  return Array.prototype.indexOf.call(list.children, node);
}

type Mode = "pointer" | "keyboard";

export function ReorderableList<
  T extends { id: string; position: number },
>(props: {
  items: T[];
  /** Singular noun for the hint and announcements, e.g. "service". */
  noun: string;
  /** Names one row in announcements and button labels. */
  label: (item: T) => string;
  /** Image tiles sit in a grid; services pair up; contacts stack. */
  layout: "rows" | "pairs" | "grid";
  /** True while a save is in flight — the controls lock rather than queue. */
  busy?: boolean;
  /** Preview a new order without saving (mid-drag, arrow keys). */
  onMove: (next: T[]) => void;
  /** Commit a new order and persist it. */
  onCommit: (next: T[]) => void;
  /** Renders one row; `controls` belongs in that row's actions slot. */
  children: (item: T, controls: JSX.Element) => JSX.Element;
}) {
  const hintId = createUniqueId();
  const [held, setHeld] = createSignal<number | null>(null);
  const [mode, setMode] = createSignal<Mode | null>(null);
  const [message, setMessage] = createSignal("");

  let listEl: HTMLUListElement | undefined;
  /** The order when the grab started, so Escape has something to go back to. */
  let origin: T[] | null = null;
  /** Kept so the lift can be cleared without hunting for the row again. */
  let grabbedRow: HTMLElement | null = null;
  /** The grip being held, so a move can hand focus straight back to it. */
  let grabbedHandle: HTMLElement | null = null;

  /**
   * Reordering moves the row, and moving a focused node blurs it. Focus is
   * handed back on the next tick so the arrow keys keep working through a
   * run of moves instead of dying after the first one.
   */
  function keepFocus(element: HTMLElement | null) {
    if (!element) return;
    queueMicrotask(() => element.focus());
  }

  const count = () => props.items.length;
  const at = (index: number) => props.items[index];

  // Re-announce even when the words repeat, so the live region always fires.
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  function place(name: string, index: number) {
    return `${name} moved to position ${index + 1} of ${count()}.`;
  }

  function grab(
    handle: HTMLElement,
    row: HTMLElement | null,
    index: number,
    next: Mode,
  ) {
    origin = props.items.slice();
    grabbedRow = row;
    grabbedHandle = handle;
    if (row) row.dataset.grabbed = "true";
    setHeld(index);
    setMode(next);
  }

  function release() {
    if (grabbedRow) delete grabbedRow.dataset.grabbed;
    grabbedRow = null;
    grabbedHandle = null;
    origin = null;
    setHeld(null);
    setMode(null);
  }

  function commit() {
    const next = props.items.slice();
    release();
    props.onCommit(next);
  }

  function cancel() {
    const before = origin;
    release();
    if (before) props.onMove(before);
  }

  // ── Pointer drag. The rows reorder live under the cursor, so the dragged
  // row is its own placeholder: it carries the dashed outline in the slot it
  // would land in, and its neighbours have already moved aside.

  function onHandleDragStart(event: DragEvent, index: number) {
    const handle = event.currentTarget as HTMLElement;
    const row = handle.closest("li");
    if (props.busy || !row || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    // Firefox drops a drag that carries no data.
    event.dataTransfer.setData("text/plain", at(index).id);
    // Drag the whole row rather than the grip it started from.
    event.dataTransfer.setDragImage(row, 16, 16);
    grab(handle, row, index, "pointer");
  }

  function onListDragOver(event: DragEvent) {
    const from = held();
    if (from === null || mode() !== "pointer" || !listEl) return;

    // Without this the drop never lands.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

    const target = (event.target as Element | null)?.closest("li") ?? null;
    const to = indexOfRow(listEl, target);
    if (to === -1 || to === from) return;

    setHeld(to);
    props.onMove(moveItem(props.items, from, to));
  }

  function onListDrop(event: DragEvent) {
    const index = held();
    if (index === null || mode() !== "pointer") return;
    event.preventDefault();
    announce(place(props.label(at(index)), index));
    commit();
  }

  /** Fires after `drop`, so a still-held row means the drag ended off-list. */
  function onHandleDragEnd() {
    if (held() === null) return;
    announce("Move cancelled.");
    cancel();
  }

  // ── Keyboard drag (§4.4): space to pick up, arrows to move, space to drop,
  // escape to cancel, with every step announced.

  function onHandleKeyDown(event: KeyboardEvent, index: number) {
    const holding = mode() === "keyboard" && held() !== null;

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!holding) {
        const handle = event.currentTarget as HTMLElement;
        grab(handle, handle.closest("li"), index, "keyboard");
        announce(
          `${props.label(at(index))} grabbed. Position ${index + 1} of ${count()}. Use the arrow keys to move it, space to drop, escape to cancel.`,
        );
        return;
      }
      announce(`${props.label(at(held() as number))} dropped.`);
      commit();
      return;
    }

    if (!holding) return;

    if (event.key === "Escape") {
      event.preventDefault();
      announce("Move cancelled.");
      cancel();
      return;
    }

    const delta =
      event.key === "ArrowUp" || event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? 1
          : 0;
    if (delta === 0) return;
    event.preventDefault();

    const from = held() as number;
    const to = from + delta;
    if (to < 0 || to >= count()) {
      announce(delta < 0 ? "Already first." : "Already last.");
      return;
    }

    const name = props.label(at(from));
    const handle = event.currentTarget as HTMLElement;
    setHeld(to);
    props.onMove(moveItem(props.items, from, to));
    keepFocus(handle);
    announce(place(name, to));
  }

  /**
   * Tabbing away mid-move saves rather than leaving the row stuck in hand.
   * The move itself also blurs the grip, though, so the decision waits a tick:
   * focus that landed nowhere is the row moving and gets handed back, and only
   * focus that genuinely went somewhere else counts as leaving.
   */
  function onHandleBlur(event: FocusEvent) {
    if (mode() !== "keyboard" || held() === null) return;
    const handle = event.currentTarget as HTMLElement;

    queueMicrotask(() => {
      if (mode() !== "keyboard" || held() === null) return;
      const focused = document.activeElement;
      if (!focused || focused === document.body) {
        (grabbedHandle ?? handle).focus();
        return;
      }
      if (focused === grabbedHandle) return;
      commit();
    });
  }

  // ── Up / down. The drag needs a pointer or a grabbed handle; these are the
  // plain way to do the same thing, and the only one on a touch screen.

  function nudge(event: MouseEvent, index: number, delta: number) {
    if (props.busy) return;
    const to = index + delta;
    if (to < 0 || to >= count()) {
      announce(delta < 0 ? "Already first." : "Already last.");
      return;
    }
    const name = props.label(at(index));
    const button = event.currentTarget as HTMLElement;
    const next = moveItem(props.items, index, to);
    announce(place(name, to));
    props.onCommit(next);
    // The button rode along with its row, so focus goes back to it and the
    // owner can press again without reaching for the mouse.
    keepFocus(button);
  }

  const renderControls = (item: T, index: Accessor<number>) => {
    const name = () => props.label(item);
    const holding = () => mode() === "keyboard" && held() === index();

    return (
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          draggable={!props.busy}
          disabled={props.busy}
          aria-pressed={holding()}
          aria-describedby={hintId}
          onDragStart={(event) => onHandleDragStart(event, index())}
          onDragEnd={onHandleDragEnd}
          onKeyDown={(event) => onHandleKeyDown(event, index())}
          onBlur={onHandleBlur}
          class={cn(
            controlClass,
            "cursor-grab aria-pressed:bg-primary-soft aria-pressed:text-primary",
          )}
        >
          <IconGripVertical aria-hidden="true" class="size-4" />
          <span class="sr-only">
            Reorder {name()}, position {index() + 1} of {count()}
          </span>
        </button>

        <button
          type="button"
          disabled={props.busy}
          aria-disabled={index() === 0}
          onClick={(event) => nudge(event, index(), -1)}
          class={controlClass}
        >
          <IconArrowUp aria-hidden="true" class="size-4" />
          <span class="sr-only">Move {name()} earlier</span>
        </button>

        <button
          type="button"
          disabled={props.busy}
          aria-disabled={index() === count() - 1}
          onClick={(event) => nudge(event, index(), 1)}
          class={controlClass}
        >
          <IconArrowDown aria-hidden="true" class="size-4" />
          <span class="sr-only">Move {name()} later</span>
        </button>
      </div>
    );
  };

  return (
    <div class="flex flex-col gap-3">
      <p aria-live="polite" class="sr-only">
        {message()}
      </p>
      <p id={hintId} class="sr-only">
        Press space to pick this {props.noun} up, the arrow keys to move it,
        space to drop it, and escape to cancel. The up and down buttons move it
        one place at a time.
      </p>

      <ul
        ref={listEl}
        aria-busy={props.busy}
        onDragOver={onListDragOver}
        onDrop={onListDrop}
        class={cn(
          props.layout === "grid" && "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
          props.layout === "pairs" && "grid gap-3 sm:grid-cols-2",
          props.layout === "rows" && "flex flex-col gap-2",
          props.busy && "opacity-60",
          // The row lifts on pick-up and keeps a dashed outline in the slot it
          // would land in. Reduced motion drops the lift, never the outline.
          "[&>li]:transition-[box-shadow,opacity,transform] [&>li]:duration-[var(--duration-fast)] [&>li]:ease-[var(--ease-out)] motion-reduce:[&>li]:transition-none",
          "[&>li[data-grabbed]]:opacity-70 [&>li[data-grabbed]]:outline-2 [&>li[data-grabbed]]:outline-dashed [&>li[data-grabbed]]:outline-offset-2 [&>li[data-grabbed]]:outline-border-strong",
          "motion-safe:[&>li[data-grabbed]]:scale-[1.02] motion-safe:[&>li[data-grabbed]]:shadow-[0_8px_24px_rgb(0_0_0/0.12)]",
        )}
      >
        <For each={props.items}>
          {(item, index) => props.children(item, renderControls(item, index))}
        </For>
      </ul>

      <p aria-hidden="true" class="text-xs text-text-muted">
        Drag the grip to reorder, or use the arrows. This is the order partners
        see on your profile.
      </p>
    </div>
  );
}

/** Reorder controls sit left of edit and remove, split by a hairline. */
export function RowToolbar(props: {
  reorder: JSX.Element;
  actions: JSX.Element;
}) {
  return (
    <div class="flex shrink-0 items-center gap-0.5">
      {props.reorder}
      <span aria-hidden="true" class="mx-0.5 h-5 w-px bg-border" />
      {props.actions}
    </div>
  );
}

export function PanelSkeleton(props: { rows: number }) {
  return (
    <div aria-busy="true" class="flex flex-col gap-2">
      <span class="sr-only">Loading…</span>
      <For each={Array.from({ length: props.rows })}>
        {() => <Skeleton class="h-20 w-full rounded-md" />}
      </For>
    </div>
  );
}
