import { For } from "solid-js";
import { sentimentTrend } from "@/features/reviews/review-data";

export function SentimentTrendChart() {
  const summary = sentimentTrend
    .map(
      (point) =>
        `${point.date}: ${point.positive} positive and ${point.negative} negative`,
    )
    .join(". ");

  return (
    <section
      aria-labelledby="sentiment-trend-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 id="sentiment-trend-heading" class="text-lg font-semibold text-foreground">
          Sentiment Trend
        </h2>

        <div class="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Chart legend">
          <span class="flex items-center gap-2">
            <span class="size-3 rounded-sm bg-primary" aria-hidden="true" />
            Positive
          </span>
          <span class="flex items-center gap-2">
            <span
              class="size-3 rounded-sm border border-slate-400 bg-[repeating-linear-gradient(135deg,#94a3b8_0_2px,#f8fafc_2px_4px)]"
              aria-hidden="true"
            />
            Negative
          </span>
        </div>
      </div>

      <div class="mt-7 grid h-64 grid-cols-7 gap-2 sm:gap-4">
        <For each={sentimentTrend}>
          {(point) => (
            <div class="flex min-w-0 flex-col items-center">
              <button
                type="button"
                aria-label={`${point.date}: ${point.positive} positive reviews and ${point.negative} negative reviews`}
                class="group flex h-52 w-full min-w-0 items-end justify-center gap-1 rounded-md px-1 transition-colors hover:bg-muted focus:bg-muted"
              >
                <span
                  class="relative block w-3 rounded-t-sm border border-slate-400 bg-[repeating-linear-gradient(135deg,#94a3b8_0_2px,#f8fafc_2px_4px)] sm:w-4"
                  style={{ height: `${point.negative}%` }}
                  aria-hidden="true"
                />
                <span
                  class="relative block w-3 rounded-t-sm bg-primary sm:w-4"
                  style={{ height: `${point.positive}%` }}
                  aria-hidden="true"
                >
                  <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground shadow-sm group-hover:block group-focus:block">
                    {point.positive} Positive
                  </span>
                </span>
              </button>

              <span
                class={`mt-2 text-xs ${point.date === "5 Jul"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
                  }`}
              >
                {point.date}
              </span>
            </div>
          )}
        </For>
      </div>

      <p class="sr-only">Sentiment trend data. {summary}.</p>
    </section>
  );
}
