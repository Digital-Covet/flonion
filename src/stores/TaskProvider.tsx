import { createSignal, onMount, type ParentProps } from "solid-js";
import { notify } from "~/components/ui/toast";
import {
  type CreateMeetingData,
  type CreateTaskData,
  type Task,
  type TaskAssignee,
  TaskContext,
  type TaskContextValue,
  type TeamMeeting,
  type UpdateTaskData,
} from "./task-store";

export function TaskProvider(props: ParentProps) {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [meetings, setMeetings] = createSignal<TeamMeeting[]>([]);
  const [teamMembers, setTeamMembers] = createSignal<TaskAssignee[]>([]);
  const [filter, setFilter] = createSignal<string>("whole-team");
  const [currentUserId, setCurrentUserId] = createSignal<string | null>(null);
  const [canManageTasks, setCanManageTasks] = createSignal(false);
  const [tasksLoading, setTasksLoading] = createSignal(true);
  const [tasksError, setTasksError] = createSignal<string | null>(null);

  const clearTasksError = () => setTasksError(null);

  const failTaskOp = (op: string, message?: string) => {
    const msg = message ?? `Couldn't ${op}. Please try again.`;
    setTasksError(msg);
    notify("error", msg);
  };

  const fetchTasks = async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const params = new URLSearchParams();
      const currentFilter = filter();
      if (currentFilter !== "whole-team" && currentFilter !== "by-employee") {
        params.set("assigneeId", currentFilter);
      }
      const url = params.toString() ? `/api/tasks?${params}` : "/api/tasks";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      } else {
        setTasksError("Couldn't load tasks.");
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setTasksError("Couldn't load tasks. Check your connection.");
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/team-meetings");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch("/api/business");
      if (res.ok) {
        const data = await res.json();
        if (data.teamMembers) {
          setTeamMembers(data.teamMembers);
        }
        setCurrentUserId(data.currentUserId ?? null);
        setCanManageTasks(!!data.isOwner || data.role === "admin");
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  };

  // Mirrors the permission check in PATCH/DELETE /api/tasks/[id] and
  // /api/tasks/reorder: owner/admins may modify any task, members only
  // tasks assigned to them.
  const canEditTask = (task: Task) =>
    canManageTasks() || task.assigneeId === currentUserId();

  const addTask = async (data: CreateTaskData): Promise<Task | null> => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        notify("success", "Task created");
        return task;
      }
      const err = await res.json().catch(() => null);
      failTaskOp("create task", err?.error);
      return null;
    } catch (err) {
      console.error("Failed to add task:", err);
      failTaskOp("create task");
      return null;
    }
  };

  const updateTask = async (
    taskId: string,
    data: UpdateTaskData,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        return true;
      }
      const err = await res.json().catch(() => null);
      // 403 = permission notice from the server; surface the reason.
      failTaskOp(
        "save task",
        err?.error ??
          (res.status === 403
            ? "You can only edit tasks assigned to you."
            : undefined),
      );
      return false;
    } catch (err) {
      console.error("Failed to update task:", err);
      failTaskOp("save task");
      return false;
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        notify("success", "Task deleted");
        return true;
      }
      const err = await res.json().catch(() => null);
      failTaskOp("delete task", err?.error);
      return false;
    } catch (err) {
      console.error("Failed to delete task:", err);
      failTaskOp("delete task");
      return false;
    }
  };

  const moveTask = async (
    taskId: string,
    targetColumn: string,
    newPosition: number,
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, targetColumn, newPosition }),
      });
      if (res.ok) {
        setTasks((prev) => {
          const taskIndex = prev.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return prev;

          const task = prev[taskIndex];
          const updatedTask = {
            ...task,
            column: targetColumn,
            position: newPosition,
          };

          const filtered = prev.filter((t) => t.id !== taskId);
          const columnTasks = filtered
            .filter((t) => t.column === targetColumn)
            .sort((a, b) => a.position - b.position);

          columnTasks.splice(newPosition, 0, updatedTask);

          const otherTasks = filtered.filter((t) => t.column !== targetColumn);

          return [...otherTasks, ...columnTasks];
        });
        return true;
      }
      const err = await res.json().catch(() => null);
      failTaskOp("move task", err?.error);
      return false;
    } catch (err) {
      console.error("Failed to move task:", err);
      failTaskOp("move task");
      return false;
    }
  };

  const addMeeting = async (
    data: CreateMeetingData,
  ): Promise<TeamMeeting | null> => {
    try {
      const res = await fetch("/api/team-meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const meeting = await res.json();
        setMeetings((prev) => [...prev, meeting]);
        return meeting;
      }
      return null;
    } catch (err) {
      console.error("Failed to add meeting:", err);
      return null;
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      const res = await fetch(`/api/team-meetings/${meetingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
    }
  };

  onMount(async () => {
    await Promise.all([fetchTasks(), fetchMeetings(), fetchTeamMembers()]);
  });

  const value: TaskContextValue = {
    tasks,
    meetings,
    teamMembers,
    filter,
    setFilter,
    currentUserId,
    canManageTasks,
    canEditTask,
    tasksLoading,
    tasksError,
    clearTasksError,
    fetchTasks,
    fetchMeetings,
    fetchTeamMembers,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    addMeeting,
    deleteMeeting,
  };

  return (
    <TaskContext.Provider value={value}>{props.children}</TaskContext.Provider>
  );
}
