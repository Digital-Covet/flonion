import { Menu } from "@ark-ui/solid/menu";
import { Progress } from "@ark-ui/solid/progress";
import { Tooltip } from "@ark-ui/solid/tooltip";
import {
  AlertTriangle,
  AlignLeft,
  ArrowUpDown,
  CheckCircle,
  Clock,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { type Task, useTaskContext } from "~/stores/task-store";
import { BOARD_COLUMNS } from "./task-board";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onDragStart?: (e: DragEvent, task: Task) => void;
  onDragEnd?: (e: DragEvent, task: Task) => void;
  onDelete?: (taskId: string) => Promise<void> | void;
  onEdit?: (task: Task) => void;
}

export default function TaskCard(props: TaskCardProps) {
  const { deleteTask, moveTask, tasks, canEditTask } = useTaskContext();
  const [isDragging, setIsDragging] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  // Owner/admins may modify any task; members only tasks assigned to them.
  // The server enforces the same rule -- this only hides the affordances.
  const canEdit = () => canEditTask(props.task);
  const isDone = () => props.task.column === "done";
  const isWaiting = () => props.task.column === "waiting";
  const hasProgress = () => props.task.column === "in_progress";

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isDeleting()) return;
    setIsDeleting(true);
    try {
      if (props.onDelete) {
        await props.onDelete(props.task.id);
      } else {
        await deleteTask(props.task.id);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const badgeText = () => {
    if (props.task.priority === "high") return "High Priority";
    if (props.task.priority === "medium") return "Medium";
    if (props.task.priority === "low") return "Low";
    return null;
  };

  const assigneeInitials = () => {
    const name = props.task.assignee?.name || "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const dueLabel = () => {
    if (!props.task.dueDate) return null;
    const d = new Date(props.task.dueDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = () => {
    if (!props.task.dueDate || isDone()) return false;
    const d = new Date(props.task.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  // Keyboard alternative to drag-and-drop (spec §6): move up/down within the
  // column or jump to another column. Positions mirror the board's ordering.
  const columnTasks = () =>
    tasks()
      .filter((t) => t.column === props.task.column)
      .sort((a, b) => a.position - b.position);

  const indexInColumn = () =>
    columnTasks().findIndex((t) => t.id === props.task.id);

  const moveUp = () => {
    const i = indexInColumn();
    if (i > 0) void moveTask(props.task.id, props.task.column, i - 1);
  };

  const moveDown = () => {
    const i = indexInColumn();
    if (i >= 0 && i < columnTasks().length - 1)
      void moveTask(props.task.id, props.task.column, i + 1);
  };

  const moveToColumn = (columnId: string) => {
    if (columnId === props.task.column) return;
    const targetCount = tasks().filter((t) => t.column === columnId).length;
    void moveTask(props.task.id, columnId, targetCount);
  };

  const handleDragStart = (e: DragEvent) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", props.task.id);
      e.dataTransfer.effectAllowed = "move";
    }
    setIsDragging(true);
    props.onDragStart?.(e, props.task);
  };

  const handleDragEnd = (e: DragEvent) => {
    setIsDragging(false);
    props.onDragEnd?.(e, props.task);
  };

  return (
    // Drag handle itself is mouse-only; the Move menu below is the keyboard path.
    // biome-ignore lint/a11y/noStaticElementInteractions: draggable card; keyboard users get the equivalent Move menu
    <div
      draggable={canEdit() ? "true" : "false"}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      class={`group rounded-card border bg-card p-4 shadow-sm transition-all duration-150 motion-reduce:transition-none ${
        isDragging() ? "scale-[0.98] border-primary opacity-40" : ""
      } ${
        isDone()
          ? "border-border opacity-60"
          : isWaiting()
            ? "border-dashed border-border opacity-80 hover:opacity-100"
            : hasProgress()
              ? "border-border border-l-2 border-l-primary hover:shadow-md"
              : "border-border hover:border-control hover:shadow-md"
      }`}
    >
      <div class="mb-2 flex items-start justify-between gap-2">
        <Show when={badgeText()} fallback={<span />}>
          <span
            class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              props.task.priority === "high"
                ? "bg-warning-muted text-warning"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {props.task.priority === "high" && (
              <AlertTriangle size={14} aria-hidden="true" />
            )}
            {badgeText()}
          </span>
        </Show>
        <div class="flex shrink-0 items-center gap-1">
          <Show when={canEdit()}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onEdit?.(props.task);
                }}
                aria-label={`Edit task ${props.task.title}`}
                class="grid min-h-11 min-w-11 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Pencil size={16} aria-hidden="true" />
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-50">
                    Edit task
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </Show>
          <Show when={canEdit()}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={handleDelete}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isDeleting()}
                aria-label={`Delete task ${props.task.title}`}
                class="grid min-h-11 min-w-11 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-50">
                    Delete task
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </Show>
          <Show when={canEdit()}>
            <Menu.Root>
              <Menu.Trigger
                aria-label={`Move task "${props.task.title}"`}
                class="grid min-h-11 min-w-11 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <GripVertical size={16} aria-hidden="true" />
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content class="z-50 min-w-48 rounded-card border border-border bg-card p-1.5 shadow-lg">
                    <Menu.Item
                      value="up"
                      disabled={indexInColumn() <= 0}
                      onSelect={moveUp}
                      class="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted disabled:opacity-40"
                    >
                      <ArrowUpDown size={14} aria-hidden="true" />
                      Move up
                    </Menu.Item>
                    <Menu.Item
                      value="down"
                      disabled={
                        indexInColumn() < 0 ||
                        indexInColumn() >= columnTasks().length - 1
                      }
                      onSelect={moveDown}
                      class="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted disabled:opacity-40"
                    >
                      <ArrowUpDown
                        size={14}
                        class="rotate-180"
                        aria-hidden="true"
                      />
                      Move down
                    </Menu.Item>
                    <div
                      class="mx-2 my-1 border-t border-border"
                      aria-hidden="true"
                    />
                    <For each={BOARD_COLUMNS}>
                      {(col) => (
                        <Menu.Item
                          value={`col-${col.id}`}
                          disabled={col.id === props.task.column}
                          onSelect={() => moveToColumn(col.id)}
                          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted disabled:opacity-40"
                        >
                          Move to {col.title}
                        </Menu.Item>
                      )}
                    </For>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Show>
        </div>
      </div>

      <p
        class={`mb-2 line-clamp-2 text-sm font-medium transition-colors ${
          isDone() || isWaiting()
            ? "text-muted-foreground"
            : "text-foreground group-hover:text-primary"
        }`}
      >
        {props.task.title}
      </p>

      <Show when={dueLabel()}>
        <p
          class={`tnum mb-2 flex items-center gap-1.5 text-xs font-medium ${
            isOverdue() ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Show
            when={isOverdue()}
            fallback={<Clock size={14} aria-hidden="true" />}
          >
            <AlertTriangle size={14} aria-hidden="true" />
          </Show>
          {isOverdue() ? `Overdue · ${dueLabel()}` : `Due ${dueLabel()}`}
        </p>
      </Show>

      <Show when={hasProgress()}>
        <Progress.Root
          value={60}
          aria-label="Task progress"
          class="mb-3 w-full"
        >
          <Progress.Track class="h-1 rounded-full bg-border">
            <Progress.Range class="h-1 rounded-full bg-primary" />
          </Progress.Track>
        </Progress.Root>
      </Show>

      <div class="mt-4 flex items-end justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <Show
            when={props.task.assignee?.image}
            fallback={
              <Show when={isDone()}>
                <CheckCircle
                  size={16}
                  class="shrink-0 text-success"
                  aria-hidden="true"
                />
              </Show>
            }
          >
            {(image) => (
              <img alt="" class="size-6 shrink-0 rounded-full" src={image()} />
            )}
          </Show>
          <Show when={!isDone()}>
            <Show
              when={props.task.assignee?.image}
              fallback={
                <span
                  aria-hidden="true"
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-warning-muted text-xs font-medium text-warning"
                >
                  {assigneeInitials()}
                </span>
              }
            >
              <span />
            </Show>
            <span class="truncate text-xs font-medium text-muted-foreground">
              {props.task.assignee?.name || "Unassigned"}
            </span>
          </Show>
        </div>
        <Show when={props.task.description && !isDone() && !isWaiting()}>
          <Tooltip.Root>
            <Tooltip.Trigger aria-label="Has description">
              <AlignLeft
                size={16}
                class="text-muted-foreground"
                aria-hidden="true"
              />
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg">
                  Has description
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        </Show>
        <Show when={isWaiting()}>
          <Tooltip.Root>
            <Tooltip.Trigger aria-label="Pending review">
              <Clock size={16} class="text-warning" aria-hidden="true" />
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg">
                  Pending Review
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        </Show>
      </div>
    </div>
  );
}
