import { createSignal, onMount, type ParentProps } from "solid-js";
import {
  TaskContext,
  type TaskContextValue,
  type Task,
  type TeamMeeting,
  type TaskAssignee,
  type CreateTaskData,
  type CreateMeetingData,
} from "./task-store";

export function TaskProvider(props: ParentProps) {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [meetings, setMeetings] = createSignal<TeamMeeting[]>([]);
  const [teamMembers, setTeamMembers] = createSignal<TaskAssignee[]>([]);
  const [filter, setFilter] = createSignal<string>("whole-team");

  const fetchTasks = async () => {
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
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
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
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  };

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
        return task;
      }
      return null;
    } catch (err) {
      console.error("Failed to add task:", err);
      return null;
    }
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const moveTask = async (taskId: string, targetColumn: string, newPosition: number) => {
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
          const updatedTask = { ...task, column: targetColumn, position: newPosition };

          const filtered = prev.filter((t) => t.id !== taskId);
          const columnTasks = filtered
            .filter((t) => t.column === targetColumn)
            .sort((a, b) => a.position - b.position);

          columnTasks.splice(newPosition, 0, updatedTask);

          const otherTasks = filtered.filter((t) => t.column !== targetColumn);

          return [...otherTasks, ...columnTasks];
        });
      }
    } catch (err) {
      console.error("Failed to move task:", err);
    }
  };

  const addMeeting = async (data: CreateMeetingData): Promise<TeamMeeting | null> => {
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
    <TaskContext.Provider value={value}>
      {props.children}
    </TaskContext.Provider>
  );
}
