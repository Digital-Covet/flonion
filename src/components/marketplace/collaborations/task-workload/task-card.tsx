import { AlignLeft, CheckCircle, Clock, GripVertical, Trash2 } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Progress } from "@ark-ui/solid/progress";
import { Tooltip } from "@ark-ui/solid/tooltip";
import { Portal } from "solid-js/web";
import { useTaskContext, type Task } from "~/stores/task-store";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onDragStart?: (e: DragEvent, task: Task) => void;
  onDragEnd?: (e: DragEvent, task: Task) => void;
  onDelete?: (taskId: string) => Promise<void> | void;
}

export default function TaskCard(props: TaskCardProps) {
  const { deleteTask } = useTaskContext();
  const [isDragging, setIsDragging] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
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

  const badgeVariant = () => {
    if (props.task.priority === "high") return "high-priority";
    return "internal";
  };

  const badgeText = () => {
    if (props.task.priority === "high") return "High Priority";
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
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      class={`bg-card rounded p-4 shadow-sm group cursor-grab active:cursor-grabbing border transition-all duration-150 ${
        isDragging() ? "opacity-40 scale-[0.98] border-primary" : ""
      } ${
        isDone()
          ? "border-border opacity-60"
          : isWaiting()
            ? "border-border border-dashed opacity-75 hover:opacity-100 transition-opacity"
            : hasProgress()
              ? "border-l-2 border-l-primary border-t border-r border-b border-border hover:shadow-md"
              : "border-border hover:border-primary"
      }`}
    >
      <div class="flex justify-between items-start mb-2">
        <Show when={badgeText()} fallback={<span />}>
          <span
            class={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
              badgeVariant() === "high-priority"
                ? "bg-orange-muted text-orange"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {badgeText()}
          </span>
        </Show>
        <div class="flex items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger
              type="button"
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isDeleting()}
              aria-label="Delete task"
              class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-all opacity-60 md:opacity-0 md:group-hover:opacity-100 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-50">
                  Delete task
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
          <GripVertical
            size={14}
            class="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      <p
        class={`text-sm font-medium mb-2 line-clamp-2 transition-colors ${isDone()
            ? "text-muted-foreground"
            : isWaiting()
              ? "text-muted-foreground"
              : "text-foreground group-hover:text-primary"
          }`}
      >
        {props.task.title}
      </p>

      <Show when={hasProgress()}>
        <Progress.Root value={60} class="w-full mb-3">
          <Progress.Track class="bg-border rounded-full h-1">
            <Progress.Range class="bg-primary h-1 rounded-full" />
          </Progress.Track>
        </Progress.Root>
      </Show>

      <div class="flex justify-between items-end mt-4">
        <div class="flex items-center gap-2">
          <Show
            when={props.task.assignee?.image}
            fallback={
              <Show when={isDone()}>
                <CheckCircle size={16} class="text-positive" />
              </Show>
            }
          >
            <img
              alt="Assignee"
              class="w-6 h-6 rounded-full"
              src={props.task.assignee?.image!}
            />
          </Show>
          <Show when={!isDone()}>
            <Show
              when={props.task.assignee?.image}
              fallback={
                <span class="w-6 h-6 rounded-full bg-orange-muted text-orange flex items-center justify-center text-xs font-medium">
                  {assigneeInitials()}
                </span>
              }
            >
              <span />
            </Show>
            <span class="text-xs font-medium text-muted-foreground">
              {props.task.assignee?.name || "Unassigned"}
            </span>
          </Show>
        </div>
        <Show when={props.task.description && !isDone() && !isWaiting()}>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <AlignLeft size={16} class="text-muted-foreground" />
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
            <Tooltip.Trigger>
              <Clock size={16} class="text-orange" />
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
