import { createListCollection, Select } from "@ark-ui/solid/select";
import { Tabs } from "@ark-ui/solid/tabs";
import { A } from "@solidjs/router";
import { CalendarDays } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import DailyWorkload from "~/components/marketplace/collaborations/task-workload/daily-workload";
import MeetingCard from "~/components/marketplace/collaborations/task-workload/meeting-card";
import TaskBoard from "~/components/marketplace/collaborations/task-workload/task-board";
import TaskDialog from "~/components/marketplace/collaborations/task-workload/task-dialog";
import { TaskProvider } from "~/stores/TaskProvider";
import { type Task, useTaskContext } from "~/stores/task-store";

const filterCollection = createListCollection({
  items: [
    { label: "Whole Team", value: "whole-team" },
    { label: "By Employee", value: "by-employee" },
  ],
});

function ProjectsContent() {
  const { meetings, filter, setFilter } = useTaskContext();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false);
  const [editingTask, setEditingTask] = createSignal<Task | null>(null);

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

  return (
    <main class="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col gap-6 bg-background min-h-screen text-foreground">
      {/* Header Controls */}
      <section class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl shadow-sm border border-border">
        <div class="flex items-center gap-4">
          <h2 class="text-2xl font-bold font-heading text-foreground">
            Tasks & Workload
          </h2>
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
                <A
                  class="text-sm font-medium text-primary hover:underline ml-2"
                  href="/collaborations/meeting-schedular"
                >
                  View All
                </A>
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
          <TaskBoard
            onAddTask={() => setIsCreateDialogOpen(true)}
            onEditTask={(task) => setEditingTask(task)}
          />
        </div>

        {/* Sidebar: Daily Workload */}
        <aside class="xl:col-span-1">
          <DailyWorkload />
        </aside>
      </div>

      <TaskDialog
        open={isCreateDialogOpen()}
        onOpenChange={setIsCreateDialogOpen}
      />
      <TaskDialog
        open={!!editingTask()}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        task={editingTask()}
      />
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
