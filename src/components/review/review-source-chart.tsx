import { For } from "solid-js";
import { reviewSources } from "@/features/reviews/review-data";

const sourceColorClasses = {
  primary: "bg-primary",
  info: "bg-info",
  purple: "bg-purple",
} as const;

const sourceStrokeColors = {
  primary: "#0060ff",
  info: "#2563eb",
  purple: "#7c3aed",
} as const;

export function ReviewSourceChart() {
  let cumulativeOffset = 0;

  const chartSegments = reviewSources.map((source) => {
    const offset = cumulativeOffset;
    cumulativeOffset += source.percentage;

    return {
      ...source,
      offset,
    };
  });

  const sourceSummary = reviewSources
    .map((source) => `${source.name} ${source.percentage}%`)
    .join(", ");

  return (
    <section
      aria-labelledby="review-sources-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <h2 id="review-sources-heading" class="text-lg font-semibold text-foreground">
        Review Sources
      </h2>

      <div class="mt-5 flex flex-col items-center">
        <div class="relative size-40">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Review source distribution: ${sourceSummary}`}
            class="size-full -rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e2e8f0"
              stroke-width="16"
            />
            <For each={chartSegments}>
              {(source) => (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  pathLength="100"
                  stroke={sourceStrokeColors[source.color]}
                  stroke-width="16"
                  stroke-dasharray={`${source.percentage} ${100 - source.percentage}`}
                  stroke-dashoffset={-source.offset}
                />
              )}
            </For>
          </svg>

          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-semibold tracking-tight text-foreground">1.2K</span>
            <span class="text-xs text-muted-foreground">Total</span>
          </div>
        </div>

        <ul class="mt-5 w-full space-y-3">
          <For each={reviewSources}>
            {(source) => (
              <li class="flex items-center justify-between gap-3 text-sm">
                <span class="flex items-center gap-2 text-muted-foreground">
                  <span
                    class={`size-3 rounded-sm ${sourceColorClasses[source.color]}`}
                    aria-hidden="true"
                  />
                  {source.name}
                </span>
                <strong class="text-foreground">{source.percentage}%</strong>
              </li>
            )}
          </For>
        </ul>
      </div>

      <p class="sr-only">Review source values: {sourceSummary}.</p>
    </section>
  );
}
