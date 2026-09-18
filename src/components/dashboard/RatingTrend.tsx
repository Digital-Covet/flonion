import { IconChartLine, IconTable } from "@tabler/icons-solidjs";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { focusRing } from "~/components/auth/AuthShell";
import { stars } from "~/components/dashboard/data";
import { cn } from "~/lib/cn";
import type { GoogleReview } from "~/types/google";

export type TrendPoint = {
  key: string;
  short: string;
  long: string;
  average: number | null;
  count: number;
};

/** Monthly average star rating for the last `months` calendar months. */
export function monthlyTrend(
  reviews: GoogleReview[],
  months: number,
  now = new Date(),
): TrendPoint[] {
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      short: d.toLocaleDateString(undefined, { month: "short" }),
      long: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      sum: 0,
      count: 0,
    };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of reviews) {
    const d = new Date(r.createTime);
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i === undefined) continue;
    buckets[i].sum += stars(r);
    buckets[i].count += 1;
  }
  return buckets.map(({ sum, ...b }) => ({
    ...b,
    average: b.count ? sum / b.count : null,
  }));
}

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 28 };
const Y_TICKS = [1, 2, 3, 4, 5];

/**
 * Single-series line (primary, 2px) on a fixed 1–5 scale, with a crosshair
 * tooltip and a table alternative. Months without reviews break the line
 * instead of inventing a value.
 */
export function RatingTrendChart(props: { points: TrendPoint[] }) {
  const [width, setWidth] = createSignal(640);
  const [hover, setHover] = createSignal<number | null>(null);
  const [asTable, setAsTable] = createSignal(false);
  let box: HTMLDivElement | undefined;

  onMount(() => {
    if (!box) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, entry.contentRect.width)),
    );
    ro.observe(box);
    onCleanup(() => ro.disconnect());
  });

  const plotW = () => width() - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = () => plotW() / Math.max(1, props.points.length);
  const x = (i: number) => PAD.left + step() * (i + 0.5);
  const y = (v: number) => PAD.top + plotH - ((v - 1) / 4) * plotH;

  const path = createMemo(() => {
    let d = "";
    let pen = false;
    props.points.forEach((p, i) => {
      if (p.average === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.average).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const summary = () => {
    const known = props.points.filter((p) => p.average !== null);
    if (!known.length) return "No reviews in this period.";
    return `Average rating by month: ${known
      .map((p) => `${p.long} ${p.average?.toFixed(1)}`)
      .join(", ")}.`;
  };

  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(1));

  return (
    <div ref={box} class="flex flex-col gap-3">
      <div class="flex justify-end">
        <button
          type="button"
          aria-pressed={asTable()}
          onClick={() => setAsTable(!asTable())}
          class={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-text-muted hover:bg-primary-soft hover:text-text",
            focusRing,
          )}
        >
          <Show
            when={asTable()}
            fallback={<IconTable aria-hidden="true" class="size-4" />}
          >
            <IconChartLine aria-hidden="true" class="size-4" />
          </Show>
          {asTable() ? "Show chart" : "Show table"}
        </button>
      </div>

      <Show
        when={!asTable()}
        fallback={
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <caption class="sr-only">Average Google rating by month</caption>
              <thead>
                <tr class="border-b border-border text-left text-text-muted">
                  <th scope="col" class="py-2 font-medium">
                    Month
                  </th>
                  <th scope="col" class="py-2 text-right font-medium">
                    Average rating
                  </th>
                  <th scope="col" class="py-2 text-right font-medium">
                    Reviews
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={props.points}>
                  {(p) => (
                    <tr class="h-11 border-b border-border last:border-0">
                      <th scope="row" class="text-left font-normal text-text">
                        {p.long}
                      </th>
                      <td class="text-right font-mono tabular-nums">
                        {fmt(p.average)}
                      </td>
                      <td class="text-right font-mono tabular-nums">
                        {p.count}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        }
      >
        <div class="relative">
          <svg
            role="img"
            aria-label={summary()}
            width={width()}
            height={HEIGHT}
            class="block max-w-full overflow-visible"
            onPointerMove={(e) => {
              // Hit target is the whole month column, far wider than the mark.
              const left = e.currentTarget.getBoundingClientRect().left;
              const i = Math.floor((e.clientX - left - PAD.left) / step());
              setHover(i >= 0 && i < props.points.length ? i : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <For each={Y_TICKS}>
              {(t) => (
                <g>
                  <line
                    x1={PAD.left}
                    x2={width() - PAD.right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="var(--border)"
                    stroke-dasharray={t === 1 ? undefined : "2 4"}
                  />
                  <text
                    x={PAD.left - 10}
                    y={y(t)}
                    text-anchor="end"
                    dominant-baseline="middle"
                    class="fill-text-muted font-mono text-xs"
                  >
                    {t}
                  </text>
                </g>
              )}
            </For>

            <For each={props.points}>
              {(p, i) => (
                <text
                  x={x(i())}
                  y={HEIGHT - 8}
                  text-anchor="middle"
                  class={cn(
                    "text-xs",
                    hover() === i() ? "fill-text" : "fill-text-muted",
                  )}
                >
                  {p.short}
                </text>
              )}
            </For>

            <Show when={hover() !== null}>
              <line
                x1={x(hover() ?? 0)}
                x2={x(hover() ?? 0)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--border-strong)"
                stroke-width="1"
              />
            </Show>

            <path
              d={path()}
              fill="none"
              stroke="var(--primary)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <For each={props.points}>
              {(p, i) => (
                <Show when={p.average !== null}>
                  <circle
                    cx={x(i())}
                    cy={y(p.average ?? 1)}
                    r={hover() === i() ? 5 : 4}
                    fill="var(--primary)"
                    stroke="var(--surface)"
                    stroke-width="2"
                  />
                </Show>
              )}
            </For>
          </svg>

          <Show
            when={hover() !== null ? props.points[hover() ?? 0] : undefined}
          >
            {(p) => (
              <div
                aria-hidden="true"
                class="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
                style={{
                  left: `${Math.min(
                    Math.max(x(hover() ?? 0), 80),
                    width() - 80,
                  )}px`,
                }}
              >
                <p class="font-medium text-text">{p().long}</p>
                <p class="text-text-muted">
                  <span class="font-mono text-text tabular-nums">
                    {fmt(p().average)}
                  </span>{" "}
                  average ·{" "}
                  <span class="font-mono tabular-nums">{p().count}</span>{" "}
                  {p().count === 1 ? "review" : "reviews"}
                </p>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
