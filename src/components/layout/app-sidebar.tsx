import {
  ChevronLeft,
  Gauge,
  Inbox,
  Megaphone,
  PenSquare,
  SearchCheck,
  Settings,
} from "lucide-solid";
import { A, useLocation } from "@solidjs/router";
import { For, Show } from "solid-js";
import { useSettings } from "~/stores/settings-store";
import LogoComponent from "~/assets/logo";

interface NavigationItem {
  label: string;
  href: string;
  icon: typeof Gauge;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Management",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Gauge },
      { label: "Review Inbox", href: "/reviews/inbox", icon: Inbox },
      {
        label: "Ask a Review",
        href: "/reviews/new",
        icon: PenSquare,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "SEO Optimizer", href: "/marketing/seo", icon: SearchCheck },
      { label: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export function Brand() {
  const { logo } = useSettings();

  return (
    <div class="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
      <Show when={logo()} fallback={<LogoComponent class="h-8 w-auto" />}>
        <img src={logo()!} alt="Agency logo" class="h-8 w-auto object-contain" />
      </Show>
    </div>
  );
}

export function ProfileSummary() {
  return (
    <div class="flex items-center gap-3">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        aria-label="Harper Nelson initials"
      >
        HN
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-foreground">Harper Nelson</p>
        <p class="truncate text-xs text-muted-foreground">Admin Manager</p>
      </div>
    </div>
  );
}

export function NavigationContent(props: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav aria-label="Primary navigation" class="space-y-6">
      <For each={navigationGroups}>
        {(group) => (
          <section aria-labelledby={`navigation-${group.label}`}>
            <h2
              id={`navigation-${group.label}`}
              class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {group.label}
            </h2>
            <ul class="space-y-1">
              <For each={group.items}>
                {(item) => {
                  const Icon = item.icon;
                  const isActive = () =>
                    location.pathname === item.href ||
                    location.pathname.startsWith(item.href + "/");

                  return (
                    <li>
                      <A
                        href={item.href}
                        onClick={props.onNavigate}
                        activeClass="bg-primary/10 text-primary"
                        inactiveClass="text-muted-foreground hover:bg-muted hover:text-foreground"
                        class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                        aria-current={isActive() ? "page" : undefined}
                      >
                        <Icon class="size-4" aria-hidden="true" />
                        {item.label}
                      </A>
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>
        )}
      </For>
    </nav>
  );
}

export function AppSidebar() {
  return (
    <aside class="hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div class="flex items-center justify-between px-5 py-5">
        <Brand />
        <button
          type="button"
          aria-label="Collapse sidebar"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-2">
        <NavigationContent />
      </div>

      <div class="border-t border-border p-4">
        <ProfileSummary />
      </div>
    </aside>
  );
}
