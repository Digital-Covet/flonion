import { Dialog } from "@ark-ui/solid/dialog";
import { A } from "@solidjs/router";
import { IconMenu, IconX } from "@tabler/icons-solidjs";
import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { authClient } from "~/lib/auth-client";
import { SITE_ORIGIN } from "~/lib/site";

// `auth` links are only shown once the visitor is signed in.
const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/marketplace", label: "Marketplace", auth: true },
];

const navLink =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-[var(--duration-fast)] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/*
 * Buttons are a shell plus a skin plus a size. Keep the size in the constant
 * you pick, never in an override: `cn` is a plain join, so appending
 * `min-h-9 px-3` to `btnPrimary` loses to the `min-h-11 px-5` already in it —
 * Tailwind emits the smaller value first, so the larger one wins the cascade.
 */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const btnPrimarySkin =
  "bg-primary text-primary-foreground transition-[filter,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.98]";
const btnSecondarySkin =
  "border border-border-strong text-text transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft";

export const btnPrimary = `${btnBase} ${btnPrimarySkin} min-h-11 px-5 text-base`;

export const btnSecondary = `${btnBase} ${btnSecondarySkin} min-h-11 px-5 text-base`;

/** Compact size, for buttons inside notices, cards and table rows. */
export const btnPrimarySm = `${btnBase} ${btnPrimarySkin} min-h-9 px-3 text-sm`;

export const btnSecondarySm = `${btnBase} ${btnSecondarySkin} min-h-9 px-3 text-sm`;

// The canonical host is `app.flonion.com`; keep the CTAs absolute so they
// resolve there even when the page is served from an alias like `flonion.com`.
export const LOGIN_URL = `${SITE_ORIGIN}/login`;
export const SIGNUP_URL = `${SITE_ORIGIN}/signup`;

export function SiteHeader() {
  const [open, setOpen] = createSignal(false);
  // Only the CTA is dynamic: SSR renders "Start free", and a signed-in
  // visitor sees "Go to dashboard" once the session resolves.
  const session = authClient.useSession();
  const signedIn = () => Boolean(session().data?.user);
  const nav = () => NAV.filter((item) => !item.auth || signedIn());

  return (
    <header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div class="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6">
        <A
          href="/"
          class="flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <InlineCombinationMark class="h-6 w-auto" />
          <span class="sr-only">Flonion home</span>
        </A>

        <nav aria-label="Main" class="hidden lg:block">
          <ul class="flex items-center gap-1">
            <For each={nav()}>
              {(item) => (
                <li>
                  <a href={item.href} class={navLink}>
                    {item.label}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </nav>

        <div class="hidden items-center gap-2 lg:flex">
          <Show
            when={signedIn()}
            fallback={
              <>
                <a href={LOGIN_URL} class={btnSecondary}>
                  Log in
                </a>
                <a href={SIGNUP_URL} class={btnPrimary}>
                  Start free
                </a>
              </>
            }
          >
            <A href="/dashboard" class={btnPrimary}>
              Go to dashboard
            </A>
          </Show>
        </div>

        <Dialog.Root open={open()} onOpenChange={(e) => setOpen(e.open)}>
          <Dialog.Trigger
            class="grid size-11 place-items-center rounded-md text-text hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
            aria-label="Open menu"
          >
            <IconMenu aria-hidden="true" class="size-6" />
          </Dialog.Trigger>
          <Portal>
            <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0 data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out-0" />
            <Dialog.Positioner class="fixed inset-0 z-50 flex justify-end">
              <Dialog.Content class="flex h-full w-[min(20rem,100%)] flex-col gap-6 bg-background p-4 text-text shadow-xl data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:slide-in-from-right data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-right">
                <div class="flex items-center justify-between">
                  <Dialog.Title class="font-display text-lg font-semibold">
                    Menu
                  </Dialog.Title>
                  <Dialog.CloseTrigger
                    class="grid size-11 place-items-center rounded-md hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label="Close menu"
                  >
                    <IconX aria-hidden="true" class="size-6" />
                  </Dialog.CloseTrigger>
                </div>
                <nav aria-label="Mobile">
                  <ul class="flex flex-col">
                    <For each={nav()}>
                      {(item) => (
                        <li>
                          <a
                            href={item.href}
                            class={`${navLink} w-full text-base text-text`}
                            onClick={() => setOpen(false)}
                          >
                            {item.label}
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </nav>
                <div class="mt-auto flex flex-col gap-2">
                  <Show
                    when={signedIn()}
                    fallback={
                      <>
                        <a href={SIGNUP_URL} class={btnPrimary}>
                          Start free
                        </a>
                        <a href={LOGIN_URL} class={btnSecondary}>
                          Log in
                        </a>
                      </>
                    }
                  >
                    <A href="/dashboard" class={btnPrimary}>
                      Go to dashboard
                    </A>
                  </Show>
                </div>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
