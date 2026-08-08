import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import Gauge from "lucide-solid/icons/gauge";
import Inbox from "lucide-solid/icons/inbox";
import LogOut from "lucide-solid/icons/log-out";
import BarChart3 from "lucide-solid/icons/bar-chart-3";
import Megaphone from "lucide-solid/icons/megaphone";
import PenSquare from "lucide-solid/icons/pen-square";
import SearchCheck from "lucide-solid/icons/search-check";
import Settings from "lucide-solid/icons/settings";
import User from "lucide-solid/icons/user";
import UserCircle from "lucide-solid/icons/user-circle";

import { Menu } from "@ark-ui/solid/menu";
import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import InlineCombinationMark from "@/assets/inline-combination-mark";
import { authClient } from "~/lib/auth-client";
import { useSettings } from "~/stores/settings-store";

const SIDEBAR_COLLAPSED_KEY = "revme-sidebar-collapsed";

function loadCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      String(value),
    );
  } catch {
    // Storage may be unavailable due to privacy mode,
    // disabled storage, or browser policy.
  }
}

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
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
      },
      {
        label: "Review Inbox",
        href: "/reviews/inbox",
        icon: Inbox,
      },
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
      {
        label: "SEO Optimizer",
        href: "/marketing/seo",
        icon: SearchCheck,
      },
      {
        label: "Analytics",
        href: "/marketing/analytics",
        icon: BarChart3,
      },
      {
        label: "Campaigns",
        href: "/marketing/campaigns",
        icon: Megaphone,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
      {
        label: "Account",
        href: "/account",
        icon: UserCircle,
      },
    ],
  },
];

export function Brand(props: { collapsed?: boolean }) {
  const { logo, businessName } = useSettings();

  return (
    <div class="flex min-w-0 flex-col gap-1 overflow-hidden">
      <div
        class="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        aria-label="Flonion"
      >
        <InlineCombinationMark
          class={`h-6 shrink-0 ${props.collapsed ? "w-8" : "w-auto"}`}
          aria-hidden="true"
        />
      </div>

      <Show when={!props.collapsed && businessName()}>
        <p class="truncate px-0.5 text-xs text-muted-foreground">
          {businessName()}
        </p>
      </Show>
    </div>
  );
}

export function ProfileSummary(props: { collapsed?: boolean }) {
  const session = authClient.useSession();
  const navigate = useNavigate();

  const displayName = createMemo(() => {
    const user = session()?.data?.user;

    return user?.name || user?.email || "User";
  });

  const email = createMemo(
    () => session()?.data?.user?.email || "",
  );

  const initials = createMemo(() => {
    const name = session()?.data?.user?.name;

    if (!name) {
      return "?";
    }

    return name
      .split(" ")
      .filter(Boolean)
      .map((part: string) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  });

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/sign-in");
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        class={`flex min-w-0 items-center gap-3 rounded-md text-left transition-colors hover:bg-muted ${props.collapsed ? "justify-center px-1 py-1" : "w-full px-2 py-1"}`}
        aria-label={props.collapsed ? displayName() : undefined}
      >
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {initials()}
        </div>

        <Show when={!props.collapsed}>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">
              {displayName()}
            </p>

            <Show when={email()}>
              <p class="truncate text-xs text-muted-foreground">
                {email()}
              </p>
            </Show>
          </div>
        </Show>
      </Menu.Trigger>

      <Menu.Positioner>
        <Menu.Content class="min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <Menu.Item
            value="account-settings"
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onSelect={() => navigate("/account")}
          >
            <User class="size-4 shrink-0" aria-hidden="true" />
            Account Settings
          </Menu.Item>

          <Menu.Separator class="my-1 h-px bg-border" />

          <Menu.Item
            value="logout"
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onSelect={handleLogout}
          >
            <LogOut class="size-4 shrink-0" aria-hidden="true" />
            Logout
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

export function NavigationContent(
  props: {
    onNavigate?: () => void;
    collapsed?: boolean;
  },
) {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary navigation"
      class="space-y-6"
    >
      <For each={navigationGroups}>
        {(group) => {
          const headingId = `navigation-${group.label
            .toLowerCase()
            .replace(/\s+/g, "-")}`;

          return (
            <section
              aria-labelledby={
                props.collapsed ? undefined : headingId
              }
              aria-label={
                props.collapsed ? group.label : undefined
              }
            >
              <Show
                when={!props.collapsed}
                fallback={null}
              >
                <h2
                  id={headingId}
                  class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {group.label}
                </h2>
              </Show>

              <ul class="space-y-1">
                <For each={group.items}>
                  {(item) => {
                    const Icon = item.icon;

                    const isActive = createMemo(
                      () =>
                        location.pathname === item.href ||
                        location.pathname.startsWith(
                          `${item.href}/`,
                        ),
                    );

                    return (
                      <li>
                        <A
                          href={item.href}
                          onClick={props.onNavigate}
                          activeClass="bg-primary/10 text-primary"
                          inactiveClass="text-muted-foreground hover:bg-muted hover:text-foreground"
                          class={`flex items-center rounded-md text-sm font-medium transition-colors ${props.collapsed
                            ? "justify-center px-2 py-2"
                            : "gap-3 px-3 py-2"
                            }`}
                          aria-current={
                            isActive()
                              ? "page"
                              : undefined
                          }
                          aria-label={
                            props.collapsed
                              ? item.label
                              : undefined
                          }
                          title={
                            props.collapsed
                              ? item.label
                              : undefined
                          }
                        >
                          <Icon
                            class="size-4 shrink-0"
                            aria-hidden="true"
                          />

                          <Show when={!props.collapsed}>
                            <span class="truncate">
                              {item.label}
                            </span>
                          </Show>
                        </A>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </section>
          );
        }}
      </For>
    </nav>
  );
}

export function AppSidebar() {
  // Keep SSR markup deterministic.
  // localStorage is read only after hydration.
  const [collapsed, setCollapsed] = createSignal(false);

  onMount(() => {
    setCollapsed(loadCollapsed());
  });

  const toggleCollapse = () => {
    const next = !collapsed();

    setCollapsed(next);
    saveCollapsed(next);
  };

  return (
    <aside
      class={`hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 lg:flex ${collapsed() ? "w-16" : "w-64"
        }`}
      aria-label="Application sidebar"
    >
      <header
        class={`flex h-18 shrink-0 items-center ${collapsed()
          ? "justify-center px-2"
          : "justify-between px-5"
          }`}
      >
        <Brand collapsed={collapsed()} />

        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={
            collapsed()
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          aria-expanded={!collapsed()}
          aria-controls="sidebar-navigation"
          class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Show
            when={collapsed()}
            fallback={
              <ChevronLeft
                class="size-4"
                aria-hidden="true"
              />
            }
          >
            <ChevronRight
              class="size-4"
              aria-hidden="true"
            />
          </Show>
        </button>
      </header>

      <div
        id="sidebar-navigation"
        class="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      >
        <NavigationContent
          collapsed={collapsed()}
        />
      </div>

      <footer class="shrink-0 border-t border-border p-4">
        <ProfileSummary
          collapsed={collapsed()}
        />
      </footer>
    </aside>
  );
}
