import { Progress } from "@ark-ui/solid/progress";
import { PieChart, TrendingUp } from "lucide-solid";
import { For, Show } from "solid-js";
import { Skeleton } from "~/components/ui/skeleton";
import { useTaskContext } from "~/stores/task-store";

const COLORS = [
  "bg-primary",
  "bg-info",
  "bg-warning",
  "bg-purple",
  "bg-success",
];

/**
 * Flonion DS §6: capacity as bars with numbers — tabular numerals,
 * text labels, per-widget loading. Never colour alone.
 */
export default function DailyWorkload() {
  const { tasks, teamMembers, tasksLoading } = useTaskContext();

  const totalTasks = () => tasks().length;

  const completedTasks = () =>
    tasks().filter((t) => t.column === "done").length;

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
    <div class="flex h-full flex-col gap-5 rounded-card border border-border bg-card p-5 shadow-sm">
      <div class="border-b border-border pb-3">
        <h2 class="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <PieChart
            size={20}
            class="shrink-0 text-primary"
            aria-hidden="true"
          />
          Daily Workload
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Capacity across team today
        </p>
      </div>

      <Show
        when={!tasksLoading()}
        fallback={
          <div class="grid gap-2" aria-hidden="true">
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-2 w-full rounded-full" />
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-4 w-full" />
          </div>
        }
      >
        <div>
          <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Task Completion
          </p>
          <Progress.Root
            value={completionRate()}
            min={0}
            max={100}
            aria-label={`Task completion ${completionRate()} percent`}
            class="w-full"
          >
            <Progress.ValueText class="tnum font-heading text-3xl font-semibold text-foreground">
              {completionRate()}%
            </Progress.ValueText>
            <Progress.Track class="mt-1.5 h-2 rounded-full bg-border">
              <Progress.Range class="h-2 rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" />
            </Progress.Track>
          </Progress.Root>
          <p class="tnum mt-1 text-xs text-muted-foreground">
            {completedTasks()} of {totalTasks()} tasks done
          </p>
        </div>

        <div class="mt-1 grid gap-3">
          <h3 class="font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">
            By Employee
          </h3>
          <Show
            when={employeeWorkloads().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">No team members yet</p>
            }
          >
            <ul class="grid gap-3">
              <For each={employeeWorkloads()}>
                {(workload) => (
                  <li class="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      class={`size-2.5 shrink-0 rounded-full ${workload.colorClass}`}
                    />
                    <div class="min-w-0 flex-1">
                      <Progress.Root
                        value={workload.percentage}
                        min={0}
                        max={100}
                        aria-label={`${workload.name}: ${workload.count} active tasks`}
                        class="w-full"
                      >
                        <div class="mb-1 flex items-center justify-between gap-2">
                          <span class="truncate text-sm font-medium text-foreground">
                            {workload.name}
                          </span>
                          <Progress.ValueText class="tnum shrink-0 text-xs font-medium text-muted-foreground">
                            {workload.count} tasks
                          </Progress.ValueText>
                        </div>
                        <Progress.Track class="h-1.5 rounded-full bg-border">
                          <Progress.Range
                            class={`h-1.5 rounded-full ${workload.colorClass}`}
                          />
                        </Progress.Track>
                      </Progress.Root>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        <div class="mt-auto rounded-card border border-secondary/20 bg-secondary/10 p-4">
          <TrendingUp
            size={20}
            class="mb-1.5 text-secondary"
            aria-hidden="true"
          />
          <h3 class="text-sm font-medium text-foreground">
            {completionRate() >= 50 ? "Good Progress" : "Keep Going"}
          </h3>
          <p class="mt-0.5 text-sm leading-6 text-muted-foreground">
            {completionRate() >= 50
              ? "Team is making solid progress on tasks today."
              : "Team is working through the task backlog."}
          </p>
        </div>
      </Show>
    </div>
  );
}
