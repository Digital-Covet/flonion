import Plus from "lucide-solid/icons/plus";
import TrendingDown from "lucide-solid/icons/trending-down";
import TrendingUp from "lucide-solid/icons/trending-up";
import { Show } from "solid-js";
import type { Metric } from "@/features/reviews/review-types";

export function MetricCard(props: { metric: Metric }) {
  const Icon = props.metric.icon;
  const isPositive = () => props.metric.trendDirection === "positive";

  return (
    <article class="flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
      <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon class="size-4" aria-hidden="true" />
        <span>{props.metric.label}</span>
      </div>

      <div class="flex items-end gap-3">
        <strong class="text-2xl leading-none tracking-tight text-foreground">
          {props.metric.value}
        </strong>

        <span
          class={`flex items-center gap-1 text-xs font-semibold ${isPositive() ? "text-positive" : "text-destructive"
            }`}
        >
          <Show
            when={isPositive()}
            fallback={<TrendingDown class="size-3.5" aria-hidden="true" />}
          >
            <TrendingUp class="size-3.5" aria-hidden="true" />
          </Show>
          {props.metric.trend}
        </span>
      </div>
    </article>
  );
}

export function DisabledMetricCard() {
  return (
    <article
      aria-disabled="true"
      class="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center"
    >
      <Plus class="size-5 text-muted-foreground" aria-hidden="true" />
      <p class="mt-1 text-sm font-medium text-muted-foreground">Add metric</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Custom metrics require configuration.
      </p>
    </article>
  );
}
