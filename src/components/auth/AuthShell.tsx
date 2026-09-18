import { A } from "@solidjs/router";
import { IconCircleX, IconEye, IconEyeOff } from "@tabler/icons-solidjs";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { OnionRings } from "~/components/landing/brand";
import { btnPrimary } from "~/components/landing/SiteHeader";
import { cn } from "~/lib/cn";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const inputBase =
  "block min-h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-base text-text placeholder:text-text-muted/80 transition-colors duration-[var(--duration-fast)] focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary aria-[invalid=true]:border-error";

export const textLink = cn(
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline",
  focusRing,
);

export const labelClass = "text-sm font-medium text-text";

export const submitClass = cn(
  btnPrimary,
  "min-h-12 w-full disabled:cursor-progress disabled:opacity-80 disabled:active:scale-100",
);

/**
 * Auth set layout (spec §6): single 440px column on the warm canvas, logo
 * home link, Onion Rings in the margins on wider screens.
 */
export function AuthShell(props: {
  /** Target of the skip link, usually the form id. */
  skipTo: string;
  skipLabel: string;
  children: JSX.Element;
  /**
   * Rendered under the card, e.g. the login ↔ signup swap link. Read once:
   * testing it in a `<Show when>` would create the JSX twice and break
   * hydration.
   */
  aside: JSX.Element;
}) {
  return (
    <div class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <OnionRings
        rings={5}
        class="absolute -top-40 -right-40 -z-10 hidden size-[640px] md:block"
      />
      <OnionRings
        rings={4}
        class="absolute -bottom-48 -left-48 -z-10 hidden size-[520px] md:block"
      />

      <a
        href={`#${props.skipTo}`}
        class={cn(
          "sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4",
          focusRing,
        )}
      >
        {props.skipLabel}
      </a>

      <header class="mx-auto flex h-16 w-full max-w-[1200px] items-center px-4 md:px-6">
        <A
          href="/"
          class={cn("flex min-h-11 items-center rounded-md", focusRing)}
        >
          <InlineCombinationMark class="h-6 w-auto" />
          <span class="sr-only">Flonion home</span>
        </A>
      </header>

      <main class="flex flex-1 items-center justify-center px-4 py-10 md:py-16">
        <div class="w-full max-w-[440px]">
          <div class="rounded-lg border border-border bg-surface p-6 shadow-[0_12px_32px_rgb(0_0_0/0.06)] sm:p-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-base)]">
            {props.children}
          </div>
          <p class="mt-6 text-center text-base text-text-muted">
            {props.aside}
          </p>
        </div>
      </main>

      <footer class="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-text-muted md:px-6">
        <span>© {new Date().getFullYear()} Flonion</span>
        <A href="/pricing" class={textLink}>
          Pricing
        </A>
        <A href="/" class={textLink}>
          Home
        </A>
      </footer>
    </div>
  );
}

/** Field-level error: icon plus words, linked to its input via `id`. */
export function FieldError(props: { id: string; message?: string }) {
  return (
    <Show when={props.message}>
      <p id={props.id} class="flex items-center gap-1.5 text-sm text-error">
        <IconCircleX aria-hidden="true" class="size-4 shrink-0" />
        {props.message}
      </p>
    </Show>
  );
}

/** Password input with a 44px show/hide toggle. */
export function PasswordInput(
  props: Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    id: string;
  },
) {
  const [local, rest] = splitProps(props, ["class", "id"]);
  const [visible, setVisible] = createSignal(false);
  return (
    <div class="relative">
      <input
        {...rest}
        id={local.id}
        type={visible() ? "text" : "password"}
        class={cn(inputBase, "pr-12", local.class)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible()}
        aria-controls={local.id}
        class={cn(
          "absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-sm text-text-muted hover:text-text",
          focusRing,
        )}
      >
        <Show
          when={visible()}
          fallback={<IconEye aria-hidden="true" class="size-5" />}
        >
          <IconEyeOff aria-hidden="true" class="size-5" />
        </Show>
        <span class="sr-only">
          {visible() ? "Hide password" : "Show password"}
        </span>
      </button>
    </div>
  );
}
