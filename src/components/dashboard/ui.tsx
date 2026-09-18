import { A } from "@solidjs/router";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChevronRight,
  IconMinus,
  IconRefresh,
} from "@tabler/icons-solidjs";
import { type JSX, Show } from "solid-js";
import { focusRing } from "~/components/auth/AuthShell";
import { btnSecondary, Notice } from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";

export const widgetClass =
  "flex flex-col rounded-lg border border-border bg-surface p-4 md:p-5";

/** Every widget is a titled section so screen-reader users can jump between them. */
export function Widget(props: {
  id: string;
  title: string;
  action?: { href: string; label: string };
  meta?: JSX.Element;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <section aria-labelledby={props.id} class={cn(widgetClass, props.class)}>
      <div class="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div class="flex items-baseline gap-2">
          <h2
            id={props.id}
            class="font-display text-lg font-semibold text-text"
          >
            {props.title}
          </h2>
          {props.meta}
        </div>
        <Show when={props.action}>
          {(action) => (
            <A
              href={action().href}
              class={cn(
                "-mr-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:underline underline-offset-4",
                focusRing,
              )}
            >
              {action().label}
              <IconChevronRight aria-hidden="true" class="size-4" />
            </A>
          )}
        </Show>
      </div>
      <div class="flex flex-1 flex-col animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none">
        {props.children}
      </div>
    </section>
  );
}

/** A failing widget reports its own error; the rest of the page stays live. */
export function WidgetError(props: { what: string; onRetry: () => void }) {
  return (
    <Notice tone="error">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>We couldn't load {props.what}.</span>
        <button
          type="button"
          onClick={() => props.onRetry()}
          class={cn(btnSecondary, "min-h-9 px-3 text-sm")}
        >
          <IconRefresh aria-hidden="true" class="size-4" />
          Retry
        </button>
      </div>
    </Notice>
  );
}

export function Skeleton(props: { class?: string }) {
  return (
    <div
      aria-hidden="true"
      class={cn(
        "rounded-sm bg-primary-soft motion-safe:animate-pulse",
        props.class,
      )}
    />
  );
}

/** Loading placeholder sized like the final content to avoid layout shift. */
export function SkeletonRows(props: { rows: number; label: string }) {
  return (
    <div aria-busy="true" class="flex flex-col gap-4">
      <span class="sr-only">Loading {props.label}…</span>
      {Array.from({ length: props.rows }, () => (
        <div class="flex items-start gap-3">
          <Skeleton class="size-9 shrink-0 rounded-full" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton class="h-4 w-2/5" />
            <Skeleton class="h-3.5 w-4/5 opacity-70" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Change indicator: icon plus words, never colour alone. */
export function DeltaChip(props: {
  value: number;
  unit?: string;
  since: string;
  format?: (n: number) => string;
}) {
  const fmt = (n: number) => (props.format ? props.format(n) : String(n));
  const dir = () =>
    props.value > 0 ? "up" : props.value < 0 ? "down" : "flat";
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        dir() === "up" && "bg-success/10 text-success",
        dir() === "down" && "bg-error/10 text-error",
        dir() === "flat" && "bg-primary-soft text-text-muted",
      )}
    >
      <Show when={dir() === "up"}>
        <IconArrowUpRight aria-hidden="true" class="size-3.5" />
      </Show>
      <Show when={dir() === "down"}>
        <IconArrowDownRight aria-hidden="true" class="size-3.5" />
      </Show>
      <Show when={dir() === "flat"}>
        <IconMinus aria-hidden="true" class="size-3.5" />
      </Show>
      <span>
        <Show when={dir() !== "flat"} fallback="No change">
          {dir() === "up" ? "Up " : "Down "}
          <span class="font-mono tabular-nums">
            {fmt(Math.abs(props.value))}
            {props.unit}
          </span>
        </Show>
        <span class="sr-only"> since {props.since}</span>
      </span>
    </span>
  );
}
