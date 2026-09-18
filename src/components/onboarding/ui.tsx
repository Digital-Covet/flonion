import { Dialog } from "@ark-ui/solid/dialog";
import { Popover } from "@ark-ui/solid/popover";
import { createListCollection, Select } from "@ark-ui/solid/select";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconCopy,
  IconHelpCircle,
  IconInfoCircle,
  IconLoader2,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { focusRing, labelClass, textLink } from "~/components/auth/AuthShell";
import { OnionRings } from "~/components/landing/brand";
import { btnPrimary, btnSecondary } from "~/components/landing/SiteHeader";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";

export { btnPrimary, btnSecondary };

export const cardClass =
  "rounded-lg border border-border bg-surface p-5 shadow-[0_12px_32px_rgb(0_0_0/0.06)] sm:p-8";

/** Step content enters with a 16px slide + fade; opacity only under reduced motion. */
export const stepEnter = (direction: "forward" | "back") =>
  cn(
    "animate-in fade-in-0 duration-[var(--duration-base)] ease-[var(--ease-out)]",
    direction === "forward"
      ? "motion-safe:slide-in-from-right-4"
      : "motion-safe:slide-in-from-left-4",
  );

type JsonResult<T> = {
  ok: boolean;
  status: number;
  data: Partial<T> & { error?: string };
};

/** JSON fetch that never throws for HTTP errors; network failures still throw. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<JsonResult<T>> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers:
      init.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const NETWORK_ERROR =
  "We couldn't reach Flonion. Check your connection and try again.";

/**
 * Focused layout (spec §6 Onboarding): no app sidebar, 640px column, and a
 * step header carrying the Onion Rings motif.
 */
export function OnboardingShell(props: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: JSX.Element;
}) {
  async function logOut() {
    await authClient.signOut().catch(() => {});
    window.location.assign("/login");
  }

  return (
    <div class="flex min-h-dvh flex-col bg-background">
      <a
        href="#onboarding-main"
        class={cn(
          "sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50",
          focusRing,
        )}
      >
        Skip to setup
      </a>

      <header class="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 md:px-6">
        <span class="flex min-h-11 items-center">
          <InlineCombinationMark class="h-6 w-auto" />
          <span class="sr-only">Flonion</span>
        </span>
        <button
          type="button"
          onClick={logOut}
          class={cn("min-h-11 px-2 text-sm", textLink)}
        >
          Log out
        </button>
      </header>

      <main
        id="onboarding-main"
        class="mx-auto w-full max-w-[640px] flex-1 px-4 pt-4 pb-10 md:pt-8 md:pb-16"
      >
        <div class="relative isolate overflow-hidden rounded-xl border border-border bg-surface px-5 py-6 sm:px-8 sm:py-8">
          <OnionRings
            rings={5}
            class="absolute -top-40 -right-40 -z-10 size-[320px]"
          />
          <p class="font-display text-sm font-semibold tracking-wide text-primary uppercase">
            {props.eyebrow}
          </p>
          <h1 class="mt-2 max-w-[28ch] font-display text-xl font-semibold text-balance text-text sm:text-2xl">
            {props.title}
          </h1>
          <Show when={props.lead}>
            <p class="mt-2 max-w-[48ch] text-base text-pretty text-text-muted">
              {props.lead}
            </p>
          </Show>
        </div>

        <div class="mt-6">{props.children}</div>
      </main>
    </div>
  );
}

export const STEPS = [
  "Business basics",
  "Review platforms",
  "Review settings",
  "Invite team",
] as const;

/**
 * Numbered stepper on md+; below md it collapses to "Step 2 of 4" with a
 * progress bar.
 */
export function Stepper(props: { current: number }) {
  return (
    <nav aria-label="Setup progress" class="mb-6">
      <div class="md:hidden">
        <p class="flex items-baseline justify-between text-sm">
          <span class="font-medium text-text">
            Step <span class="font-mono tabular-nums">{props.current}</span> of{" "}
            <span class="font-mono tabular-nums">{STEPS.length}</span>
          </span>
          <span class="text-text-muted">{STEPS[props.current - 1]}</span>
        </p>
        <div
          aria-hidden="true"
          class="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft"
        >
          <div
            class="h-full origin-left rounded-full bg-primary transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
            style={{ transform: `scaleX(${props.current / STEPS.length})` }}
          />
        </div>
      </div>

      <ol class="hidden items-start md:flex">
        <For each={STEPS}>
          {(label, i) => {
            const n = () => i() + 1;
            const done = () => n() < props.current;
            const active = () => n() === props.current;
            return (
              <li
                aria-current={active() ? "step" : undefined}
                class="relative flex flex-1 flex-col items-center gap-2 text-center"
              >
                <Show when={n() < STEPS.length}>
                  <span
                    aria-hidden="true"
                    class={cn(
                      "absolute top-4 right-[calc(-50%+1.5rem)] left-[calc(50%+1.5rem)] h-px",
                      done() ? "bg-primary" : "bg-border-strong/50",
                    )}
                  />
                </Show>
                <span
                  class={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border font-mono text-sm font-medium tabular-nums transition-colors duration-[var(--duration-fast)]",
                    active() &&
                      "border-primary bg-primary text-primary-foreground",
                    done() && "border-primary bg-primary-soft text-primary",
                    !active() &&
                      !done() &&
                      "border-border-strong text-text-muted",
                  )}
                >
                  <Show when={done()} fallback={n()}>
                    <IconCheck aria-hidden="true" class="size-4" />
                  </Show>
                </span>
                <span
                  class={cn(
                    "text-sm leading-tight whitespace-nowrap",
                    active() ? "font-medium text-text" : "text-text-muted",
                  )}
                >
                  <span class="sr-only">
                    {done() ? "Completed: " : active() ? "Current: " : ""}
                  </span>
                  {label}
                </span>
              </li>
            );
          }}
        </For>
      </ol>
    </nav>
  );
}

/** Semantic banner: always icon + words, never colour alone. */
export function Notice(props: {
  tone: "error" | "warning" | "success" | "info";
  children: JSX.Element;
  class?: string;
}) {
  return (
    <div
      role={props.tone === "error" ? "alert" : "status"}
      class={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-text",
        props.tone === "error" && "border-error/40 bg-error/5",
        props.tone === "warning" && "border-warning/40 bg-warning/5",
        props.tone === "success" && "border-success/40 bg-success/5",
        props.tone === "info" &&
          "border-transparent bg-primary-soft text-primary",
        props.class,
      )}
    >
      <Switch>
        <Match when={props.tone === "error"}>
          <IconCircleX
            aria-hidden="true"
            class="mt-0.5 size-4 shrink-0 text-error"
          />
        </Match>
        <Match when={props.tone === "warning"}>
          <IconAlertTriangle
            aria-hidden="true"
            class="mt-0.5 size-4 shrink-0 text-warning"
          />
        </Match>
        <Match when={props.tone === "success"}>
          <IconCircleCheck
            aria-hidden="true"
            class="mt-0.5 size-4 shrink-0 text-success"
          />
        </Match>
        <Match when={props.tone === "info"}>
          <IconInfoCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
        </Match>
      </Switch>
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

export function Spinner(props: { class?: string }) {
  return (
    <IconLoader2
      aria-hidden="true"
      class={cn("size-5 motion-safe:animate-spin", props.class)}
    />
  );
}

/**
 * Back / Continue bar. Sticks to the bottom of the viewport below md so the
 * primary action stays in thumb reach.
 */
export function ActionBar(props: { children: JSX.Element }) {
  return (
    <div class="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:mx-0 md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {props.children}
    </div>
  );
}

/** Destructive confirmation (e.g. discarding an empty business). */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={props.open}
      role="alertdialog"
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Content class="w-full max-w-[440px] rounded-lg bg-surface p-6 text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95">
            <span class="grid size-11 place-items-center rounded-full bg-error/10 text-error">
              <IconAlertTriangle aria-hidden="true" class="size-5" />
            </span>
            <Dialog.Title class="mt-4 font-display text-lg font-semibold">
              {props.title}
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-base text-text-muted">
              {props.description}
            </Dialog.Description>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.CloseTrigger class={btnSecondary}>
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="button"
                disabled={props.pending}
                onClick={() => props.onConfirm()}
                class={cn(
                  btnPrimary,
                  "bg-error text-surface disabled:cursor-progress disabled:opacity-80",
                )}
              >
                <Show when={props.pending}>
                  <Spinner />
                </Show>
                {props.confirmLabel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** Heading that receives focus when its step arrives. */
export function StepHeading(props: {
  title: string;
  lead?: string;
  focusOnMount?: boolean;
}) {
  return (
    <div>
      <h2
        ref={(el) => {
          if (props.focusOnMount) queueMicrotask(() => el.focus());
        }}
        tabindex="-1"
        class="font-display text-lg font-semibold text-text outline-none"
      >
        {props.title}
      </h2>
      <Show when={props.lead}>
        <p class="mt-1 text-base text-text-muted">{props.lead}</p>
      </Show>
    </div>
  );
}

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

/**
 * Ark UI Select styled like `inputBase`: 44px trigger, 16px text, strong
 * border for 3:1 non-text contrast, and a listbox that keeps the trigger's
 * width. `HiddenSelect` keeps native form submission and autofill working.
 */
export function SelectField(props: {
  label: JSX.Element;
  /** Visually hide the label (e.g. repeated rows) while keeping it for screen readers. */
  hideLabel?: boolean;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  /** Allow clearing the choice by picking the selected item again. */
  deselectable?: boolean;
  class?: string;
}) {
  // Rebuilt whenever the options change: a caller whose list arrives from a
  // request (team members, say) mounts with an empty one, and a collection
  // built once would keep showing the placeholder forever.
  const collection = createMemo(() =>
    createListCollection<SelectOption>({ items: [...props.options] }),
  );

  return (
    <Select.Root
      collection={collection()}
      value={props.value ? [props.value] : []}
      onValueChange={(e) => props.onChange(e.value[0] ?? "")}
      disabled={props.disabled}
      deselectable={props.deselectable}
      name={props.name}
      positioning={{ gutter: 4, placement: "bottom-start" }}
      class={cn("flex flex-col gap-1.5", props.class)}
    >
      <Select.Label class={cn(labelClass, props.hideLabel && "sr-only")}>
        {props.label}
      </Select.Label>
      <Select.Control>
        <Select.Trigger
          class={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-3 text-left text-base text-text transition-colors duration-[var(--duration-fast)]",
            "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
            "data-[state=open]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:bg-background data-[disabled]:text-text-muted",
          )}
        >
          <Select.ValueText
            placeholder={props.placeholder ?? "Choose one"}
            class="truncate data-[placeholder-shown]:text-text-muted"
          />
          <Select.Indicator class="shrink-0 text-text-muted transition-transform duration-[var(--duration-fast)] data-[state=open]:rotate-180">
            <IconChevronDown aria-hidden="true" class="size-4" />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner class="z-50">
          <Select.Content class="max-h-72 w-[max(var(--reference-width),16rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-border-strong bg-surface p-1 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
            <For each={collection().items}>
              {(item) => (
                <Select.Item
                  item={item}
                  class="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-base outline-none data-[highlighted]:bg-primary-soft data-[state=checked]:font-medium data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                >
                  <span class="min-w-0 flex-1">
                    <Select.ItemText class="block">
                      {item.label}
                    </Select.ItemText>
                    <Show when={item.description}>
                      <span class="block text-sm font-normal text-text-muted">
                        {item.description}
                      </span>
                    </Show>
                  </span>
                  <Select.ItemIndicator class="shrink-0 text-primary">
                    <IconCheck aria-hidden="true" class="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              )}
            </For>
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

/**
 * "Where do I find this?" popover for a per-platform hint. Shared by the
 * onboarding wizard and Settings, which ask for the same links.
 */
export function HelpPopover(props: { title: string; body: string }) {
  return (
    <Popover.Root positioning={{ placement: "bottom-end", gutter: 6 }}>
      <Popover.Trigger
        class={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-sm font-medium text-primary hover:underline underline-offset-4",
          focusRing,
        )}
      >
        <IconHelpCircle aria-hidden="true" class="size-4" />
        Where do I find this?
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner class="z-50">
          <Popover.Content class="w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border-strong bg-surface p-4 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)]">
            <div class="flex items-start justify-between gap-2">
              <Popover.Title class="font-display text-base font-semibold">
                {props.title}
              </Popover.Title>
              <Popover.CloseTrigger
                aria-label="Close"
                class={cn(
                  "-mt-2 -mr-2 grid size-9 shrink-0 place-items-center rounded-sm text-text-muted hover:text-text",
                  focusRing,
                )}
              >
                <IconX aria-hidden="true" class="size-4" />
              </Popover.CloseTrigger>
            </div>
            <Popover.Description class="mt-1 text-sm text-text-muted">
              {props.body}
            </Popover.Description>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

/**
 * Compact copy action for an inline link row: the icon swaps Copy → Check for
 * 2s and a live region announces it — no toast, which would say it twice.
 */
export function CopyButton(props: {
  value: string;
  label: string;
  announce: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        class={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary-soft",
          focusRing,
        )}
      >
        <span class="relative grid size-4 place-items-center">
          <IconCopy
            aria-hidden="true"
            class={cn(
              "absolute size-4 motion-safe:transition-opacity motion-safe:duration-[var(--duration-fast)]",
              copied() ? "opacity-0" : "opacity-100",
            )}
          />
          <IconCheck
            aria-hidden="true"
            class={cn(
              "absolute size-4 motion-safe:transition-opacity motion-safe:duration-[var(--duration-fast)]",
              copied() ? "opacity-100" : "opacity-0",
            )}
          />
        </span>
        {copied() ? "Copied" : props.label}
      </button>
      <span aria-live="polite" class="sr-only">
        {copied() ? props.announce : ""}
      </span>
    </>
  );
}
