import type { JSX } from "solid-js";
import { For, Show, splitProps } from "solid-js";

/**
 * Phase 1 primitive — spec E3: per-widget skeletons shaped like final content
 * (KPI card, 3-line row, chart box). Pulse 1.2s ease-in-out infinite; static
 * grey under reduced motion (see `.skeleton` + kill-switch in app.css).
 * Each widget resolves independently — one slow widget never blocks the page.
 */
export function Skeleton(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "aria-label"]);
  return (
    <div
      role="status"
      aria-label={local["aria-label"] ?? "Loading"}
      aria-hidden={local["aria-label"] ? undefined : true}
      class={`skeleton rounded-control bg-slate-200 motion-reduce:animate-none ${local.class ?? ""}`}
      {...rest}
    />
  );
}

export function SkeletonKpiRow(props: { count?: number }) {
  const count = () => props.count ?? 4;
  return (
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <For each={Array.from({ length: count() })}>
        {() => (
          <div class="rounded-card border border-border bg-card p-5 shadow-sm">
            <Skeleton class="h-4 w-24" />
            <div class="mt-3">
              <Skeleton class="h-8 w-20" />
            </div>
            <div class="mt-2">
              <Skeleton class="h-3 w-28" />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export function SkeletonRows(props: { count?: number }) {
  const count = () => props.count ?? 3;
  return (
    <div class="grid gap-2" aria-hidden="true">
      <For each={Array.from({ length: count() })}>
        {() => (
          <div class="flex items-center gap-3 rounded-card border border-border bg-card p-3">
            <Skeleton class="size-10 shrink-0 rounded-full" />
            <div class="grid flex-1 gap-1.5">
              <Skeleton class="h-4 w-2/3" />
              <Skeleton class="h-3 w-1/2" />
            </div>
            <Skeleton class="h-8 w-20" />
          </div>
        )}
      </For>
    </div>
  );
}

export function SkeletonChart(props: { class?: string }) {
  return (
    <div
      class={`rounded-card border border-border bg-card p-4 ${props.class ?? ""}`}
    >
      <Skeleton class="h-4 w-32" />
      <Skeleton class="mt-3 aspect-video w-full" />
    </div>
  );
}

export function SkeletonQrTile() {
  // Fixed 240x240 reserves layout — CLS-safe per §5 budget.
  return (
    <div class="grid place-items-center">
      <Skeleton class="size-60 rounded-card" aria-label="Preparing QR code" />
    </div>
  );
}

export function WidgetError(props: {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      class="grid gap-2 rounded-card border border-destructive/20 bg-destructive-muted p-4"
    >
      <p class="text-sm text-destructive">
        {props.message ??
          "Could not load this section. Other parts of the page are unaffected."}
      </p>
      <Show when={props.onRetry}>
        <button
          type="button"
          onClick={props.onRetry}
          class="h-9 w-fit rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-opacity duration-180 hover:bg-muted motion-reduce:transition-none"
        >
          {props.retryLabel ?? "Retry"}
        </button>
      </Show>
    </div>
  );
}
