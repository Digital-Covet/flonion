import BarChart3 from "lucide-solid/icons/bar-chart-3";
import { For, Show } from "solid-js";
import { EmptyState } from "~/components/ui/empty-state";
import { SkeletonChart } from "~/components/ui/skeleton";
import { useReducedMotion } from "~/hooks/useReducedMotion";

/**
 * Flonion DS §5 / Risk §6.1 — ChartAdapter boundary.
 *
 * `solid-charts` v0.0.2 is "very early stage, API bound to iterate", so ALL
 * charts render through this adapter. Before scaling campaign analytics,
 * evaluate migration to `@tanstack/solid-charts` (0.6.5, TanStack-maintained)
 * behind this same boundary — callers must not change.
 *
 * Budget (§5): charts code-split via `lazy()` per route
 * (`/dashboard`, `/marketing/analytics`); low-power/mobile renders aggregated
 * points (max 30) without animation; reduced-motion renders instantly.
 */
export interface ChartPoint {
  label: string;
  value: number;
}

function isLowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  if (typeof window !== "undefined" && window.innerWidth < 640) return true;
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}

export function ChartAdapter(props: {
  title: string;
  points: ChartPoint[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyCtaHref?: string;
  aspectClass?: string;
}) {
  const reduced = useReducedMotion();
  const aggregated = () => {
    const pts = props.points;
    if (pts.length <= 30 || isLowPower()) {
      // Aggregate to max 30 buckets on low-power or large series.
      if (pts.length <= 30) return pts;
      const size = Math.ceil(pts.length / 30);
      const out: ChartPoint[] = [];
      for (let i = 0; i < pts.length; i += size) {
        const chunk = pts.slice(i, i + size);
        out.push({
          label: chunk[0].label,
          value: Math.round(
            chunk.reduce((s, p) => s + p.value, 0) / chunk.length,
          ),
        });
      }
      return out;
    }
    return pts;
  };
  const max = () => Math.max(1, ...aggregated().map((p) => p.value));

  return (
    <section
      aria-label={props.title}
      aria-busy={props.loading || undefined}
      class={`rounded-card border border-border bg-card p-4 shadow-sm ${props.aspectClass ?? ""}`}
    >
      <h3 class="font-heading text-lg font-medium text-foreground">{props.title}</h3>
      <Show
        when={props.loading}
        fallback={
          <Show
            when={!props.error}
            fallback={
              <p role="alert" class="mt-3 text-sm text-destructive">
                {props.error}{" "}
                <Show when={props.onRetry}>
                  <button
                    type="button"
                    onClick={props.onRetry}
                    class="underline underline-offset-2"
                  >
                    Retry
                  </button>
                </Show>
              </p>
            }
          >
            <Show
              when={aggregated().length > 0}
              fallback={
                <EmptyState
                  icon={BarChart3}
                  title="No data yet"
                  description="Connect a source or create your first review link to populate this chart."
                  primaryLabel="Create review link"
                  primaryHref="/reviews/new"
                  class="mt-3 border-0 p-4"
                />
              }
            >
              <div
                class="mt-3 flex h-52 gap-2"
                role="img"
                aria-label={`${props.title}: ${aggregated()
                  .map((p) => `${p.label} ${p.value}`)
                  .join(", ")}`}
              >
                <For each={aggregated()}>
                  {(p) => (
                    <div
                      class="flex h-full min-w-0 flex-1 flex-col"
                      title={`${p.label}: ${p.value}`}
                    >
                      <span class="tnum text-center text-xs font-medium text-foreground">
                        {p.value}
                      </span>
                      {/* Definite-height track: %-heights below resolve against
                          this flex-1 row. Zero values render a muted 2px
                          baseline so "tracked zero" never reads as missing. */}
                      <div class="flex min-h-0 flex-1 items-end">
                        <div
                          class={`w-full rounded-sm ${p.value > 0 ? "bg-primary" : "bg-muted"} ${p.value > 0 && !reduced() && !isLowPower() ? "e1-enter" : ""}`}
                          style={{
                            height:
                              p.value > 0
                                ? `${Math.max(4, Math.round((p.value / max()) * 100))}%`
                                : "2px",
                          }}
                        />
                      </div>
                      <span
                        class="truncate text-center text-xs text-muted-foreground"
                        aria-hidden="true"
                      >
                        {p.label}
                      </span>
                      <span class="tnum sr-only">
                        {p.label}: {p.value}
                      </span>
                    </div>
                  )}
                </For>
              </div>
              <p class="tnum mt-2 text-right text-xs text-muted-foreground">
                Max {max()}
              </p>
            </Show>
          </Show>
        }
      >
        <SkeletonChart class="mt-3 border-0 p-0 shadow-none" />
      </Show>
    </section>
  );
}
