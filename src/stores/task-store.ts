import type { Accessor, Setter } from "solid-js";
import { createContext, useContext } from "solid-js";

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  column: string;
  priority: string;
  dueDate: string | null;
  position: number;
  assigneeId: string;
  assignee: TaskAssignee;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMeeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetUri?: string;
  meetSpaceId?: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  column?: string;
  priority?: string;
  dueDate?: string;
  assigneeId: string;
}

/** The editable subset of a task accepted by PATCH /api/tasks/[id]. */
export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  column?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: string;
}

export interface CreateMeetingData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface TaskContextValue {
  tasks: Accessor<Task[]>;
  meetings: Accessor<TeamMeeting[]>;
  teamMembers: Accessor<TaskAssignee[]>;
  filter: Accessor<string>;
  setFilter: Setter<string>;
  /** The signed-in user's id, used to recognize "my own" tasks. */
  currentUserId: Accessor<string | null>;
  /** Owner or admin -- may edit, move, or delete any task on the board. */
  canManageTasks: Accessor<boolean>;
  /** Whether the signed-in user may edit, move, or delete the given task. */
  canEditTask: (task: Task) => boolean;
  fetchTasks: () => Promise<void>;
  fetchMeetings: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  addTask: (data: CreateTaskData) => Promise<Task | null>;
  updateTask: (taskId: string, data: UpdateTaskData) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (
    taskId: string,
    targetColumn: string,
    newPosition: number,
  ) => Promise<void>;
  addMeeting: (data: CreateMeetingData) => Promise<TeamMeeting | null>;
  deleteMeeting: (meetingId: string) => Promise<void>;
}

export const TaskContext = createContext<TaskContextValue>();

export function useTaskContext(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskProvider");
  }
  return context;
}
