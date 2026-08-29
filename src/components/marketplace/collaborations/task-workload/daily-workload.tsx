import { PieChart, TrendingUp } from "lucide-solid";
import { For, Show } from "solid-js";
import { Progress } from "@ark-ui/solid/progress";
import { useTaskContext } from "~/stores/task-store";

const COLORS = ["bg-primary", "bg-info", "bg-orange", "bg-purple", "bg-positive"];

export default function DailyWorkload() {
  const { tasks, teamMembers } = useTaskContext();

  const totalTasks = () => tasks().length;

  const completedTasks = () => tasks().filter((t) => t.column === "done").length;

  const completionRate = () => {
    const total = totalTasks();
    if (total === 0) return 0;
    return Math.round((completedTasks() / total) * 100);
  };

  const employeeWorkloads = () => {
    const members = teamMembers();
    if (members.length === 0) return [];

    const allTasks = tasks();
    return members.map((member, idx) => {
      const memberTasks = allTasks.filter((t) => t.assigneeId === member.id);
      const activeTasks = memberTasks.filter((t) => t.column !== "done").length;
      const total = allTasks.length || 1;
      return {
        name: member.name,
        count: activeTasks,
        percentage: Math.round((activeTasks / total) * 100),
        colorClass: COLORS[idx % COLORS.length],
      };
    });
  };

  return (
    <div class="bg-card p-6 rounded-xl shadow-sm border border-border flex flex-col gap-6 h-full">
      <div class="border-b border-border pb-2 mb-2">
        <h3 class="text-lg font-semibold font-heading text-foreground flex items-center gap-2">
          <PieChart size={20} class="text-primary" />
          Daily Workload
        </h3>
        <p class="text-sm font-sans text-muted-foreground mt-1">
          Capacity across team today
        </p>
      </div>

      <div>
        <div class="flex justify-between items-end mb-2">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Task Completion
          </span>
        </div>
        <Progress.Root value={completionRate()} class="w-full">
          <Progress.ValueText class="text-3xl font-bold font-heading text-foreground">
            {completionRate()}%
          </Progress.ValueText>
          <Progress.Track class="bg-border rounded-full h-2">
            <Progress.Range class="bg-primary h-2 rounded-full" />
          </Progress.Track>
        </Progress.Root>
      </div>

      <div class="flex flex-col gap-4 mt-2">
        <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          By Employee
        </h4>
        <Show
          when={employeeWorkloads().length > 0}
          fallback={
            <p class="text-sm text-muted-foreground">No team members yet</p>
          }
        >
          <For each={employeeWorkloads()}>
            {(workload) => (
              <div class="flex items-center gap-3">
                <div class={`w-2 h-2 rounded-full ${workload.colorClass}`} />
                <div class="flex-1">
                  <Progress.Root value={workload.percentage} class="w-full">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium text-foreground">{workload.name}</span>
                      <Progress.ValueText class="text-xs font-medium text-muted-foreground">
                        {workload.count} tasks
                      </Progress.ValueText>
                    </div>
                    <Progress.Track class="bg-border rounded-full h-1.5">
                      <Progress.Range class={`h-1.5 rounded-full ${workload.colorClass}`} />
                    </Progress.Track>
                  </Progress.Root>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      <div class="mt-auto bg-purple-muted p-4 rounded-lg border border-purple/10">
        <TrendingUp size={24} class="text-purple mb-2" />
        <h5 class="text-sm font-medium text-purple mb-1">
          {completionRate() >= 50 ? "Good Progress" : "Keep Going"}
        </h5>
        <p class="text-sm font-sans text-muted-foreground">
          {completionRate() >= 50
            ? "Team is making solid progress on tasks today."
            : "Team is working through the task backlog."}
        </p>
      </div>
    </div>
  );
}
