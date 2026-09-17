import { Collapsible } from "@ark-ui/solid/collapsible";
import { Tooltip } from "@ark-ui/solid/tooltip";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { Task } from "~/stores/task-store";
import TaskCard from "./task-card";

interface TaskColumnProps {
  id: string;
  title: string;
  count: number;
  headerColorClass: string;
  badgeBgClass: string;
  showAddTask?: boolean;
  tasks: Task[];
  onAddTask?: () => void;
  onDrop?: (taskId: string, targetColumn: string) => void;
  onDragOver?: (e: DragEvent) => void;
  onDelete?: (taskId: string) => Promise<void> | void;
  onEdit?: (task: Task) => void;
}

export default function TaskColumn(props: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setIsDragOver(true);
    props.onDragOver?.(e);
  };

  const handleDragLeave = (e: DragEvent) => {
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer?.getData("text/plain");
    if (taskId && props.onDrop) {
      props.onDrop(taskId, props.id);
    }
  };

  return (
    <Collapsible.Root
      class={`flex w-full flex-col rounded-card bg-muted p-3 transition-colors duration-150 motion-reduce:transition-none lg:w-70 ${
        isDragOver() ? "ring-2 ring-primary/60" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="mb-3 flex items-center justify-between gap-2 px-1">
        <Collapsible.Trigger
          aria-label={`${props.title}, ${props.count} tasks`}
          class="flex min-h-11 items-center gap-1.5 rounded-control text-xs font-medium tracking-wide uppercase transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span class={props.headerColorClass}>
            {props.title}{" "}
            <span
              class={`tnum ml-1 rounded-full px-1.5 py-0.5 ${props.badgeBgClass}`}
            >
              {props.count}
            </span>
          </span>
          <Collapsible.Indicator class="transition-transform duration-150 motion-reduce:transition-none data-[state=open]:rotate-90">
            <ChevronRight size={14} aria-hidden="true" />
          </Collapsible.Indicator>
        </Collapsible.Trigger>
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label={`Options for ${props.title}`}
            class="grid min-h-11 min-w-11 place-items-center rounded-control text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content class="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg">
                Column options
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip.Root>
      </div>
      <Collapsible.Content class="flex flex-col gap-3 data-[state=closed]:animate-collapsible-close data-[state=open]:animate-collapsible-open">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target for drag-and-drop, which has no keyboard path yet; a role here would advertise an interaction that does not exist */}
        <div
          class="flex flex-col gap-3 min-h-[100px] rounded transition-colors"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <For each={props.tasks}>
            {(task) => <TaskCard task={task} onEdit={props.onEdit} />}
          </For>
        </div>
      </Collapsible.Content>
      <Show when={props.showAddTask}>
        <button
          type="button"
          onClick={props.onAddTask}
          class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-control py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus size={16} aria-hidden="true" /> Add Task
        </button>
      </Show>
    </Collapsible.Root>
  );
}
