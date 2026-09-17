import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { IconComponent } from "~/types";
import { Skeleton } from "./skeleton";

/** Phase 1 primitive — app surfaces are opaque cards (no glass in-app §1.1). */
export function Card(props: {
  children: JSX.Element;
  class?: string;
  padded?: boolean;
}) {
  return (
    <section
      class={`rounded-card border border-border bg-card shadow-sm ${props.padded === false ? "" : "p-4"} ${props.class ?? ""}`}
    >
      {props.children}
    </section>
  );
}

export function CardHeader(props: {
  title: string;
  description?: string;
  action?: JSX.Element;
}) {
  return (
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="font-heading text-lg font-semibold text-foreground">{props.title}</h2>
        <Show when={props.description}>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {props.description}
          </p>
        </Show>
      </div>
      <Show when={props.action}>{props.action}</Show>
    </header>
  );
}

export interface KpiCardProps {
  label: string;
  value: string;
  icon: IconComponent;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  trendLabel?: string;
  loading?: boolean;
  updatedAgo?: string;
}

/**
 * Dashboard KPI tile (§6): 16px padding, tabular numerals, icon+label trend,
 * per-widget skeleton (E3) + "updated Xm ago" on success.
 */
export function KpiCard(props: KpiCardProps) {
  const [local] = splitProps(props, [
    "label",
    "value",
    "icon",
    "trend",
    "trendDirection",
    "trendLabel",
    "loading",
    "updatedAgo",
  ]);
  const trendClass = () =>
    local.trendDirection === "down"
      ? "text-destructive"
      : local.trendDirection === "flat"
        ? "text-muted-foreground"
        : "text-success";
  return (
    <article
      class="flex min-h-28 flex-col justify-between rounded-card border border-border bg-card p-5 shadow-sm"
      aria-busy={local.loading || undefined}
    >
      <Show
        when={!local.loading}
        fallback={
          <div aria-hidden="true">
            <Skeleton class="h-4 w-24" />
            <div class="mt-3">
              <Skeleton class="h-8 w-20" />
            </div>
          </div>
        }
      >
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dynamic component={local.icon} class="size-4" aria-hidden="true" />
          <span>{local.label}</span>
        </div>
        <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
          <strong class="tnum font-heading text-2xl font-semibold leading-none text-foreground">
            {local.value}
          </strong>
          <Show when={local.trend}>
            <span
              class={`flex items-center gap-1 text-xs font-medium ${trendClass()}`}
            >
              <span
                class="size-1.5 rounded-full bg-current"
                aria-hidden="true"
              />
              {local.trend}
              <Show when={local.trendLabel}>
                <span class="sr-only">{local.trendLabel}</span>
              </Show>
            </span>
          </Show>
        </div>
        <Show when={local.updatedAgo}>
          <p class="mt-1 text-xs text-muted-foreground">
            Updated {local.updatedAgo}
          </p>
        </Show>
      </Show>
    </article>
  );
}
