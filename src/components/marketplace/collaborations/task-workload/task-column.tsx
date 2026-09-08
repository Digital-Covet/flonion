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
      class={`flex flex-col bg-muted rounded-lg p-3 min-w-[280px] transition-all duration-200 ${
        isDragOver() ? "ring-2 ring-primary/60 bg-muted/80" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="flex justify-between items-center mb-3 px-1">
        <Collapsible.Trigger class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity">
          <span class={props.headerColorClass}>
            {props.title}{" "}
            <span class={`px-1.5 rounded ml-1 ${props.badgeBgClass}`}>
              {props.count}
            </span>
          </span>
          <Collapsible.Indicator class="transition-transform duration-200 data-[state=open]:rotate-90">
            <ChevronRight size={12} />
          </Collapsible.Indicator>
        </Collapsible.Trigger>
        <Tooltip.Root>
          <Tooltip.Trigger class="text-muted-foreground hover:text-primary">
            <MoreHorizontal size={16} />
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
          class="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground py-2 border border-dashed border-border rounded hover:bg-card transition-colors w-full"
        >
          <Plus size={16} /> Add Task
        </button>
      </Show>
    </Collapsible.Root>
  );
}
