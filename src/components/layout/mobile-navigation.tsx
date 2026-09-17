import { Dialog } from "@ark-ui/solid/dialog";
import { A, useLocation } from "@solidjs/router";
import Gauge from "lucide-solid/icons/gauge";
import Inbox from "lucide-solid/icons/inbox";
import Megaphone from "lucide-solid/icons/megaphone";
import Menu from "lucide-solid/icons/menu";
import Users from "lucide-solid/icons/users";
import X from "lucide-solid/icons/x";
import { createMemo, createSignal, For, Show } from "solid-js";

import { Brand, NavigationContent, ProfileSummary } from "./app-sidebar";

interface Tab {
  label: string;
  href: string;
  icon: typeof Gauge;
  match: string[];
}

const tabs: Tab[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Gauge,
    match: ["/dashboard"],
  },
  {
    label: "Reviews",
    href: "/reviews/inbox",
    icon: Inbox,
    match: ["/reviews"],
  },
  {
    label: "Marketing",
    href: "/marketing/seo",
    icon: Megaphone,
    match: ["/marketing", "/marketplace"],
  },
  {
    label: "Collaborate",
    href: "/collaborations/meeting-schedular",
    icon: Users,
    match: ["/collaborations"],
  },
];

function MoreDrawer() {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Dialog.Root
      open={isOpen()}
      onOpenChange={(details) => setIsOpen(details.open)}
    >
      <Dialog.Trigger
        aria-label="More navigation options"
        class="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-control px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Menu class="size-5" aria-hidden="true" />
        <span class="leading-none">More</span>
      </Dialog.Trigger>

      <Dialog.Backdrop class="fixed inset-0 z-40 bg-slate-950/30" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex">
        <Dialog.Content class="flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-border bg-card shadow-sm">
          <div class="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
            <Brand />
            <Dialog.CloseTrigger
              aria-label="Close navigation menu"
              class="inline-flex size-11 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X class="size-4" aria-hidden="true" />
            </Dialog.CloseTrigger>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
            <NavigationContent onNavigate={() => setIsOpen(false)} />
          </div>

          <div class="border-t border-border p-4">
            <ProfileSummary />
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

/**
 * Flonion DS §2 app shell — below `md` the sidebar becomes a bottom tab bar
 * with 5 items (Dashboard, Reviews, Marketing, Collaborate, More). Every tab
 * meets the 44px touch target; the active tab pairs colour with a label and
 * an indicator bar (never colour alone).
 */
export function MobileBottomNav() {
  const location = useLocation();

  const isTabActive = (tab: Tab) =>
    tab.match.some(
      (prefix) =>
        location.pathname === prefix ||
        location.pathname.startsWith(`${prefix}/`),
    );

  return (
    <nav
      aria-label="Primary navigation"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
      style={{ "padding-bottom": "env(safe-area-inset-bottom)" }}
    >
      <div class="flex items-stretch px-1 pt-1">
        <For each={tabs}>
          {(tab) => {
            const Icon = tab.icon;
            const active = createMemo(() => isTabActive(tab));
            return (
              <A
                href={tab.href}
                aria-current={active() ? "page" : undefined}
                class={`relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-control px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active()
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {/* Active indicator bar (colour is never the only signal). */}
                <Show when={active()}>
                  <span
                    class="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                </Show>
                <Icon class="size-5" aria-hidden="true" />
                <span class="leading-none">{tab.label}</span>
              </A>
            );
          }}
        </For>
        <MoreDrawer />
      </div>
    </nav>
  );
}

/** Backwards-compatible alias — the app shell renders the bottom tab bar. */
export function MobileNavigation() {
  return <MobileBottomNav />;
}
