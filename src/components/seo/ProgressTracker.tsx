import Sparkles from "lucide-solid/icons/sparkles";
import TrendingDown from "lucide-solid/icons/trending-down";
import TrendingUp from "lucide-solid/icons/trending-up";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { scoreColor, scoreLabel } from "~/features/seo/seo-data";
import type { SeoScoreCategory } from "~/features/seo/seo-types";
import type { ProgressData } from "../../types";
import {
  ProgressCircle,
  ProgressCircleRange,
  ProgressCircleTrack,
  ProgressRoot,
} from "../ui/progress";

interface ScoreHeaderProps extends ProgressData {
  categories?: SeoScoreCategory[];
}

/**
 * DS §6 Local SEO score header: radial score + number/label text
 * ("70/100 · Good"), delta badge (icon + text, never colour alone),
 * and category breakdown. No count-up animation.
 */
const ProgressTracker: Component<ScoreHeaderProps> = (props) => {
  const label = () => scoreLabel(props.value);
  const deltaUp = () => (props.delta ?? 0) >= 0;

  return (
    <section
      aria-labelledby="seo-score-heading"
      class="rounded-card border border-border bg-card p-5 shadow-sm"
    >
      <div class="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        <div
          class="relative size-28 shrink-0"
          role="img"
          aria-label={`${props.value} out of 100, ${label()}${props.deltaLabel ? `, ${props.deltaLabel}` : ""}`}
        >
          <ProgressRoot value={props.value} min={0} max={100}>
            <ProgressCircle>
              <ProgressCircleTrack class="stroke-border" />
              <ProgressCircleRange
                class="stroke-primary"
                stroke-linecap="round"
              />
            </ProgressCircle>
          </ProgressRoot>
          <div class="absolute inset-0 grid place-items-center text-center">
            <div aria-hidden="true">
              <p class="tnum font-heading text-2xl font-semibold leading-none text-foreground">
                {props.value}
              </p>
              <p class="mt-0.5 text-xs font-medium text-muted-foreground">
                / 100 · {label()}
              </p>
            </div>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <h2
              id="seo-score-heading"
              class="font-heading text-2xl font-semibold text-foreground"
            >
              {props.title}
            </h2>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {label()}
            </span>
            <Show when={props.deltaLabel}>
              <span class="tnum inline-flex items-center gap-1 rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success">
                <Show
                  when={deltaUp()}
                  fallback={<TrendingDown size={12} aria-hidden="true" />}
                >
                  <TrendingUp size={12} aria-hidden="true" />
                </Show>
                {props.deltaLabel}
              </span>
            </Show>
          </div>
          <p class="sr-only">
            {props.value}/100, {label()}
            {props.deltaLabel ? `, ${props.deltaLabel}` : ""}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">{props.description}</p>
          <p class="mt-1 inline-flex items-center gap-1.5 rounded-full bg-positive-muted px-3 py-1 text-xs font-medium text-primary">
            <Sparkles size={14} aria-hidden="true" />
            AI analysis active
          </p>
        </div>
      </div>

      <Show when={props.categories?.length}>
        <div class="mt-5 border-t border-border pt-4">
          <h3 class="font-heading text-lg font-medium text-foreground">
            Category breakdown
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Individual category scores (unweighted)
          </p>
          <ul class="mt-3 grid gap-3 sm:grid-cols-2">
            <For each={props.categories}>
              {(cat) => (
                <li>
                  <div class="mb-1 flex items-center justify-between text-sm">
                    <span class="font-medium text-foreground">{cat.name}</span>
                    <span class="tnum text-muted-foreground">
                      {cat.score}
                      <span class="text-xs"> / 100</span>
                    </span>
                  </div>
                  <div
                    class="h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${cat.name}: ${cat.score} out of 100`}
                  >
                    <div
                      class={`h-full rounded-full ${scoreColor(cat.score)}`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </section>
  );
};
export default ProgressTracker;
