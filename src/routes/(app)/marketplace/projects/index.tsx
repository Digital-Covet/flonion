import { createMemo, createSignal, For, Show } from "solid-js";
import { Plus, CalendarDays, X } from "lucide-solid";
import { Select, createListCollection } from "@ark-ui/solid/select";
import { Tabs } from "@ark-ui/solid/tabs";
import { Dialog } from "@ark-ui/solid/dialog";
import { Portal } from "solid-js/web";
import DailyWorkload from "~/components/marketplace/collaborations/task-workload/daily-workload";
import MeetingCard from "~/components/marketplace/collaborations/task-workload/meeting-card";
import TaskBoard from "~/components/marketplace/collaborations/task-workload/task-board";
import { TaskProvider } from "~/stores/TaskProvider";
import { useTaskContext } from "~/stores/task-store";

const filterCollection = createListCollection({
  items: [
    { label: "Whole Team", value: "whole-team" },
    { label: "By Employee", value: "by-employee" },
  ],
});

const priorityCollection = createListCollection({
  items: [
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
  ],
});

function ProjectsContent() {
  const { meetings, teamMembers, addTask, filter, setFilter } = useTaskContext();
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [taskTitle, setTaskTitle] = createSignal("");
  const [taskDescription, setTaskDescription] = createSignal("");
  const [taskAssignee, setTaskAssignee] = createSignal("");
  const [taskPriority, setTaskPriority] = createSignal("medium");

  const assigneeCollection = createMemo(() =>
    createListCollection({
      items: teamMembers().map((member) => ({
        label: member.name,
        value: member.id,
      })),
    })
  );

  const handleCreateTask = async () => {
    if (!taskTitle().trim() || !taskAssignee()) return;

    await addTask({
      title: taskTitle().trim(),
      description: taskDescription().trim() || undefined,
      assigneeId: taskAssignee(),
      priority: taskPriority(),
      column: "todo",
    });

    setTaskTitle("");
    setTaskDescription("");
    setTaskAssignee("");
    setTaskPriority("medium");
    setIsDialogOpen(false);
  };

  const todayMeetings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return meetings().filter((m: { date: string }) => {
      const meetingDate = new Date(m.date);
      return meetingDate >= today && meetingDate < tomorrow;
    });
  };

  const tomorrowMeetings = () => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    return meetings().filter((m: { date: string }) => {
      const meetingDate = new Date(m.date);
      return meetingDate >= tomorrow && meetingDate < dayAfter;
    });
  };

  const upcomingMeetings = () => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 2);

    return meetings().filter((m: { date: string }) => {
      const meetingDate = new Date(m.date);
      return meetingDate >= tomorrow;
    });
  };

  const currentMeetings = () => {
    const tab = document.querySelector("[data-state=active]")?.textContent?.trim().toLowerCase();
    if (tab === "tomorrow") return tomorrowMeetings();
    if (tab === "upcoming") return upcomingMeetings();
    return todayMeetings();
  };

  return (
    <main class="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col gap-6 bg-background min-h-screen text-foreground">
      {/* Header Controls */}
      <section class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl shadow-sm border border-border">
        <div class="flex items-center gap-4">
          <h2 class="text-2xl font-bold font-heading text-foreground">Tasks & Workload</h2>
        </div>
        <div class="flex items-center gap-3">
          <Select.Root
            collection={filterCollection}
            value={[filter()]}
            onValueChange={(details) => {
              if (details.value[0]) {
                setFilter(details.value[0]);
              }
            }}
          >
            <Select.Control>
              <Select.Trigger class="bg-card border border-border rounded-lg px-4 py-2 text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20 outline-none flex items-center gap-2">
                <Select.ValueText placeholder="Select filter" />
              </Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content class="bg-card border border-border rounded-lg shadow-lg p-1 z-50">
                  {filterCollection.items.map((item) => (
                    <Select.Item
                      item={item}
                      class="px-4 py-2 text-sm text-foreground rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
                    >
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
            <Select.HiddenSelect />
          </Select.Root>

        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div class="xl:col-span-3 flex flex-col gap-6">
          {/* Team Meetings */}
          <section class="bg-card p-6 rounded-xl shadow-sm border border-border">
            <div class="flex flex-wrap justify-between items-center mb-6 border-b border-border pb-2 gap-4">
              <h3 class="text-lg font-semibold font-heading text-foreground flex items-center gap-2">
                <CalendarDays class="text-primary" size={20} />
                Team Meetings
                <a class="text-sm font-medium text-primary hover:underline ml-2" href="#">
                  View All
                </a>
              </h3>

              <Tabs.Root defaultValue="today">
                <Tabs.List class="flex bg-muted rounded-lg p-1 border border-border">
                  <Tabs.Trigger
                    value="today"
                    class="px-4 py-1.5 text-sm font-medium text-foreground data-[selected]:bg-card data-[selected]:rounded data-[selected]:shadow-sm"
                  >
                    Today
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="tomorrow"
                    class="px-4 py-1.5 text-sm font-medium text-muted-foreground data-[selected]:text-foreground"
                  >
                    Tomorrow
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="upcoming"
                    class="px-4 py-1.5 text-sm font-medium text-muted-foreground data-[selected]:text-foreground"
                  >
                    Upcoming
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Show
                when={todayMeetings().length > 0}
                fallback={
                  <p class="col-span-3 text-sm text-muted-foreground text-center py-4">
                    No meetings scheduled for today
                  </p>
                }
              >
                <For each={todayMeetings()}>
                  {(meeting) => <MeetingCard meeting={meeting} />}
                </For>
              </Show>
            </div>
          </section>

          {/* Kanban Board */}
          <TaskBoard onAddTask={() => setIsDialogOpen(true)} />
        </div>

        {/* Sidebar: Daily Workload */}
        <aside class="xl:col-span-1">
          <DailyWorkload />
        </aside>
      </div>

      <Dialog.Root open={isDialogOpen()} onOpenChange={(details) => setIsDialogOpen(details.open)}>
        <Portal>
          <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content class="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg p-6">
              <div class="flex justify-between items-center mb-4">
                <Dialog.Title class="text-xl font-bold font-heading text-foreground">Add Task</Dialog.Title>
                <Dialog.CloseTrigger class="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer">
                  <X size={20} />
                </Dialog.CloseTrigger>
              </div>
              <Dialog.Description class="text-sm text-muted-foreground mb-4">
                Create a new project task and assign it to a team member.
              </Dialog.Description>

              <div class="flex flex-col gap-4">
                <div>
                  <label class="block text-sm font-medium text-foreground mb-1" for="task-title">
                    Title
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    placeholder="Task title"
                    value={taskTitle()}
                    onInput={(e) => setTaskTitle(e.currentTarget.value)}
                    class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-foreground mb-1" for="task-description">
                    Description
                  </label>
                  <textarea
                    id="task-description"
                    placeholder="Optional details"
                    value={taskDescription()}
                    onInput={(e) => setTaskDescription(e.currentTarget.value)}
                    class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-y"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-foreground mb-1">
                    Assignee
                  </label>
                  <Select.Root
                    collection={assigneeCollection()}
                    value={taskAssignee() ? [taskAssignee()] : []}
                    onValueChange={(details) => {
                      if (details.value[0]) setTaskAssignee(details.value[0]);
                    }}
                  >
                    <Select.Control class="w-full">
                      <Select.Trigger class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none flex items-center justify-between">
                        <Select.ValueText placeholder="Select a team member" />
                      </Select.Trigger>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content class="bg-card border border-border rounded-lg shadow-lg p-1 z-[60]">
                          <Show
                            when={assigneeCollection().items.length > 0}
                            fallback={
                              <p class="px-4 py-2 text-sm text-muted-foreground">
                                No team members available
                              </p>
                            }
                          >
                            <For each={assigneeCollection().items}>
                              {(item) => (
                                <Select.Item
                                  item={item}
                                  class="px-4 py-2 text-sm text-foreground rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
                                >
                                  <Select.ItemText>{item.label}</Select.ItemText>
                                </Select.Item>
                              )}
                            </For>
                          </Show>
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                    <Select.HiddenSelect />
                  </Select.Root>
                </div>

                <div>
                  <label class="block text-sm font-medium text-foreground mb-1">
                    Priority
                  </label>
                  <Select.Root
                    collection={priorityCollection}
                    value={[taskPriority()]}
                    onValueChange={(details) => {
                      if (details.value[0]) setTaskPriority(details.value[0]);
                    }}
                  >
                    <Select.Control class="w-full">
                      <Select.Trigger class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none flex items-center justify-between">
                        <Select.ValueText placeholder="Select priority" />
                      </Select.Trigger>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content class="bg-card border border-border rounded-lg shadow-lg p-1 z-[60]">
                          <For each={priorityCollection.items}>
                            {(item) => (
                              <Select.Item
                                item={item}
                                class="px-4 py-2 text-sm text-foreground rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
                              >
                                <Select.ItemText>{item.label}</Select.ItemText>
                              </Select.Item>
                            )}
                          </For>
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                    <Select.HiddenSelect />
                  </Select.Root>
                </div>
              </div>

              <div class="mt-6 flex justify-end gap-3">
                <Dialog.CloseTrigger class="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-border transition-colors cursor-pointer">
                  Cancel
                </Dialog.CloseTrigger>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={!taskTitle().trim() || !taskAssignee()}
                  class="px-4 py-2 text-sm font-medium text-background bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Task
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </main>
  );
}

export default function Projects() {
  return (
    <TaskProvider>
      <ProjectsContent />
    </TaskProvider>
  );
}
