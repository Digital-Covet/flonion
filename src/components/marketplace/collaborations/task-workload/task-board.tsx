import { KanbanSquare } from "lucide-solid";
import { For, createSignal } from "solid-js";
import { type Task, useTaskContext } from "~/stores/task-store";
import TaskColumn from "./task-column";

export const BOARD_COLUMNS = [
  {
    id: "todo",
    title: "To Do",
    headerColorClass: "text-muted-foreground",
    badgeBgClass: "bg-muted text-muted-foreground",
  },
  {
    id: "in_progress",
    title: "In Progress",
    headerColorClass: "text-primary",
    badgeBgClass: "bg-primary/10 text-primary",
  },
  {
    // "Waiting" = pending review; the task card shows a Pending Review clock.
    id: "waiting",
    title: "Waiting",
    headerColorClass: "text-warning",
    badgeBgClass: "bg-warning-muted text-warning",
  },
  {
    id: "done",
    title: "Done",
    headerColorClass: "text-success",
    badgeBgClass: "bg-success-muted text-success",
  },
];

const columns = BOARD_COLUMNS;

interface TaskBoardProps {
  onAddTask?: () => void;
  onEditTask?: (task: Task) => void;
  /** Controlled mobile tab — when set, only that column renders below `lg`. */
  activeColumn?: string;
  onColumnChange?: (columnId: string) => void;
}

/**
 * Flonion DS §6: kanban on `lg`, column tabs on mobile (see projects page
 * for the tab bar — `activeColumn` hides sibling columns below `lg`).
 * Cards reorder with transform/opacity only; every card ships a
 * keyboard "Move to…" menu as the tap alternative to drag.
 */
export default function TaskBoard(props: TaskBoardProps) {
  const { tasks, moveTask } = useTaskContext();
  const [mobileColumn, setMobileColumn] = createSignal("todo");

  const selected = () => props.activeColumn ?? mobileColumn();
  const select = (id: string) => {
    setMobileColumn(id);
    props.onColumnChange?.(id);
  };

  const tasksByColumn = (columnId: string) => {
    return tasks()
      .filter((t) => t.column === columnId)
      .sort((a, b) => a.position - b.position);
  };

  const handleDrop = (taskId: string, targetColumn: string) => {
    const currentTask = tasks().find((t) => t.id === taskId);
    if (currentTask && currentTask.column === targetColumn) {
      return;
    }
    const targetTasks = tasksByColumn(targetColumn);
    const newPosition = targetTasks.length;
    moveTask(taskId, targetColumn, newPosition);
  };

  return (
    <section
      aria-label="Project board"
      class="flex flex-1 flex-col overflow-hidden rounded-card border border-border bg-card p-5 shadow-sm"
    >
      <div class="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 class="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <KanbanSquare
            size={20}
            class="shrink-0 text-primary"
            aria-hidden="true"
          />
          Project Board
        </h2>
        <p class="tnum hidden text-xs text-muted-foreground sm:block">
          {tasks().length} tasks
        </p>
      </div>

      {/* Mobile column tabs — tap/keyboard alternative to horizontal scroll. */}
      <div
        class="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
        role="tablist"
        aria-label="Board columns"
      >
        <For each={columns}>
          {(column) => {
            const active = () => selected() === column.id;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active()}
                onClick={() => select(column.id)}
                class={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active()
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {column.title}
                <span
                  class={`tnum rounded-full px-1.5 text-xs font-medium ${column.badgeBgClass}`}
                >
                  {tasksByColumn(column.id).length}
                </span>
              </button>
            );
          }}
        </For>
      </div>

      <div class="min-h-[320px] flex-1 overflow-x-auto">
        <div class="flex items-start gap-4 pb-4 lg:w-max">
          <For each={columns}>
            {(column) => (
              <div
                class={
                  selected() === column.id
                    ? "min-w-0 flex-1 lg:block lg:w-auto"
                    : "hidden lg:block"
                }
              >
                <TaskColumn
                  id={column.id}
                  title={column.title}
                  count={tasksByColumn(column.id).length}
                  headerColorClass={column.headerColorClass}
                  badgeBgClass={column.badgeBgClass}
                  showAddTask={column.id === "todo"}
                  tasks={tasksByColumn(column.id)}
                  onAddTask={column.id === "todo" ? props.onAddTask : undefined}
                  onEdit={props.onEditTask}
                  onDrop={handleDrop}
                />
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
