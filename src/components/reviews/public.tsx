import { A } from "@solidjs/router";
import { IconLinkOff } from "@tabler/icons-solidjs";
import { type JSX, Show } from "solid-js";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { focusRing } from "~/components/auth/AuthShell";
import { OnionRings, RatingPill } from "~/components/landing/brand";
import { cn } from "~/lib/cn";
import type { PublicBusiness } from "~/lib/public-review";

/** Comfortable single column, max 480px, light by default (spec §6). */
export const publicCardClass =
  "rounded-xl border border-border bg-surface px-5 py-7 shadow-[0_12px_32px_rgb(0_0_0/0.06)] sm:px-7";

export function PublicShell(props: { children: JSX.Element }) {
  return (
    <div class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <OnionRings
        rings={5}
        class="absolute -top-48 -right-48 -z-10 hidden size-[640px] md:block"
      />
      <OnionRings
        rings={4}
        class="absolute -bottom-48 -left-48 -z-10 hidden size-[520px] md:block"
      />
      <main
        id="review-main"
        class="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pt-8 pb-6 sm:pt-16"
      >
        {props.children}
      </main>
      <footer class="flex justify-center px-4 pb-6">
        <A
          href="/"
          class={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs text-text-muted hover:text-text",
            focusRing,
          )}
        >
          Powered by
          <InlineCombinationMark class="h-4 w-auto" />
          <span class="sr-only">Flonion</span>
        </A>
      </footer>
    </div>
  );
}

/** Shown when the username matches no business, or the link was switched off. */
export function InactiveLink(props: { businessName?: string | null }) {
  return (
    <section
      aria-labelledby="inactive-heading"
      class={cn(
        publicCardClass,
        "my-auto flex flex-col items-center gap-3 text-center",
      )}
    >
      <span class="relative grid size-24 place-items-center">
        <OnionRings rings={3} class="absolute inset-0 size-24" />
        <IconLinkOff aria-hidden="true" class="size-8 text-primary" />
      </span>
      <h1
        id="inactive-heading"
        class="font-display text-xl font-semibold text-balance text-text"
      >
        This review link isn't active
      </h1>
      <p class="max-w-[36ch] text-base text-pretty text-text-muted">
        <Show
          when={props.businessName}
          fallback="The link may have been mistyped or switched off."
        >
          {(name) => (
            <>
              {name()} has switched this link off. Ask them for a new one if
              you'd like to leave a review.
            </>
          )}
        </Show>
      </p>
    </section>
  );
}

/** Logo, name (the H1 and the LCP) and the rating pill, above the card. */
export function BusinessHeader(props: { business: PublicBusiness }) {
  const b = () => props.business;
  return (
    <header class="flex flex-col items-center gap-3 text-center">
      <Show
        when={b().logo}
        fallback={
          <span
            aria-hidden="true"
            class="grid size-14 place-items-center rounded-lg bg-primary font-display text-xl font-semibold text-primary-foreground shadow-[0_8px_20px_rgb(91_33_182/0.25)]"
          >
            {b().name.charAt(0).toUpperCase()}
          </span>
        }
      >
        {(logo) => (
          <img
            src={logo()}
            alt=""
            width="56"
            height="56"
            class="size-14 rounded-lg border border-border object-cover"
          />
        )}
      </Show>
      <div class="flex flex-col items-center gap-1">
        <p class="text-sm text-text-muted">Leave a review for</p>
        <h1 class="font-display text-2xl font-semibold leading-tight text-balance text-text">
          {b().name}
        </h1>
      </div>
      <Show when={b().rating !== null && (b().reviewCount ?? 0) > 0}>
        <RatingPill
          rating={b().rating ?? 0}
          count={b().reviewCount ?? undefined}
        />
      </Show>
    </header>
  );
}

/** Light by default; dark only when the OS asks for it (spec §1). */
export function useOsColorScheme() {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    root.classList.toggle("dark", media.matches);
    root.style.colorScheme = media.matches ? "dark" : "light";
  };
  apply();
  media.addEventListener("change", apply);
  return () => {
    media.removeEventListener("change", apply);
    root.classList.remove("dark");
    root.style.colorScheme = "";
  };
}
