import { For } from "solid-js";
import { LayoutDashboard } from "lucide-solid";
import TaskColumn from "./task-column";
import { useTaskContext } from "~/stores/task-store";

const columns = [
  { id: "todo", title: "To Do", headerColorClass: "text-muted-foreground", badgeBgClass: "bg-border text-muted-foreground" },
  { id: "in_progress", title: "In Progress", headerColorClass: "text-primary", badgeBgClass: "bg-primary/10 text-primary" },
  { id: "waiting", title: "Waiting", headerColorClass: "text-orange", badgeBgClass: "bg-orange-muted text-orange" },
  { id: "done", title: "Done", headerColorClass: "text-positive", badgeBgClass: "bg-positive-muted text-positive" },
];

interface TaskBoardProps {
  onAddTask?: () => void;
}

export default function TaskBoard(props: TaskBoardProps) {
  const { tasks, moveTask } = useTaskContext();

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
    <section class="flex-1 flex flex-col bg-card p-6 rounded-xl shadow-sm border border-border overflow-hidden">
      <div class="flex justify-between items-center mb-6 border-b border-border pb-2">
        <h3 class="text-lg font-semibold font-heading text-foreground flex items-center gap-2">
          <LayoutDashboard size={20} class="text-primary" />
          Project Board
        </h3>
      </div>
      <div class="flex-1 min-h-[500px] overflow-x-auto">
        <div class="flex items-start gap-6 w-max pb-4">
          <For each={columns}>
            {(column) => (
              <TaskColumn
                id={column.id}
                title={column.title}
                count={tasksByColumn(column.id).length}
                headerColorClass={column.headerColorClass}
                badgeBgClass={column.badgeBgClass}
                showAddTask={column.id === "todo"}
                tasks={tasksByColumn(column.id)}
                onAddTask={column.id === "todo" ? props.onAddTask : undefined}
                onDrop={handleDrop}
              />
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
