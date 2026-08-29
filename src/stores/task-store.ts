import { createContext, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";

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
  fetchTasks: () => Promise<void>;
  fetchMeetings: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  addTask: (data: CreateTaskData) => Promise<Task | null>;
  updateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, targetColumn: string, newPosition: number) => Promise<void>;
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
