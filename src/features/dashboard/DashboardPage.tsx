import { Select, createListCollection } from "@ark-ui/solid/select";
import CalendarDays from "lucide-solid/icons/calendar-days";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { createMemo, createSignal, For } from "solid-js";
import { Title } from "@solidjs/meta";
import { metrics } from "~/features/reviews/review-data";
import { MetricCard, DisabledMetricCard } from "~/components/review/metric-card";
import { ReviewSourceChart } from "~/components/review/review-source-chart";
import { SentimentTrendChart } from "~/components/review/sentiment-trend-chart";
import { QuickActions } from "~/components/dashboard/QuickActions";
import { RecentActivity } from "~/components/dashboard/RecentActivity";
import ProgressTracker from "~/components/seo/ProgressTracker";
import ActionList from "~/components/seo/ActionList";
import { PROGRESS, ACTION_ITEMS } from "~/constants";

const timePeriodItems = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

const timePeriodCollection = createListCollection({
  items: timePeriodItems,
});

export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = createSignal(["30d"]);

  const selectedPeriodLabel = createMemo(() => {
    const selectedValue = selectedPeriod()[0];
    return (
      timePeriodItems.find((period) => period.value === selectedValue)?.label ??
      "Last 30 days"
    );
  });

  return (
    <>
      <Title>Dashboard — Cognitive Enterprise</Title>
      <div class="mx-auto max-w-7xl space-y-6 pt-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Your review performance at a glance.
            </p>
          </div>

          <Select.Root
            collection={timePeriodCollection}
            value={selectedPeriod()}
            onValueChange={(details) => setSelectedPeriod(details.value)}
            positioning={{ placement: "bottom-end" }}
          >
            <Select.Control>
              <Select.Trigger class="inline-flex h-10 min-w-52 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-muted">
                <span class="flex items-center gap-2">
                  <CalendarDays
                    class="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span class="hidden text-muted-foreground sm:inline">
                    Time period:
                  </span>
                  <Select.ValueText class="font-medium">
                    {selectedPeriodLabel()}
                  </Select.ValueText>
                </span>
                <ChevronDown
                  class="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Select.Trigger>
            </Select.Control>

            <Select.Positioner>
              <Select.Content class="z-50 mt-1 min-w-52 rounded-md border border-border bg-card p-1 shadow-sm">
                <For each={timePeriodItems}>
                  {(period) => (
                    <Select.Item
                      item={period}
                      class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-foreground outline-none data-highlighted:bg-muted"
                    >
                      <Select.ItemText>{period.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check class="size-4 text-primary" aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  )}
                </For>
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <For each={metrics}>{(metric) => <MetricCard metric={metric} />}</For>
          <DisabledMetricCard />
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <ReviewSourceChart />
          </div>
          <QuickActions />
        </div>

        <SentimentTrendChart />

        <RecentActivity />

        <ProgressTracker
          value={PROGRESS.value}
          title={PROGRESS.title}
          description={PROGRESS.description}
        />

        <ActionList items={ACTION_ITEMS} />
      </div>
    </>
  );
}
