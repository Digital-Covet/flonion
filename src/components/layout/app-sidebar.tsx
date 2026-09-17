import { Menu } from "@ark-ui/solid/menu";
import { A, useLocation, useNavigate } from "@solidjs/router";
import BarChart3 from "lucide-solid/icons/bar-chart-3";
import ChevronDown from "lucide-solid/icons/chevron-down";
import ChevronsLeft from "lucide-solid/icons/chevrons-left";
import ChevronsRight from "lucide-solid/icons/chevrons-right";
import FolderKanban from "lucide-solid/icons/folder-kanban";
import Gauge from "lucide-solid/icons/gauge";
import Inbox from "lucide-solid/icons/inbox";
import LogOut from "lucide-solid/icons/log-out";
import Megaphone from "lucide-solid/icons/megaphone";
import MessageSquare from "lucide-solid/icons/message-square";
import PenSquare from "lucide-solid/icons/pen-square";
import SearchCheck from "lucide-solid/icons/search-check";
import Settings from "lucide-solid/icons/settings";
import Store from "lucide-solid/icons/store";
import User from "lucide-solid/icons/user";
import UserCircle from "lucide-solid/icons/user-circle";
import Users from "lucide-solid/icons/users";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import InlineCombinationMark from "@/assets/inline-combination-mark";
import { authClient } from "~/lib/auth-client";
import { useSettings } from "~/stores/settings-store";

// Flonion DS §2 tokens (see @theme in app.css): controls use
// `rounded-control` (8px), cards/popovers use `rounded-card` (12px).
// `rounded-soft` (20px) is the public-page Soft layer — never for app chrome.
// (`rounded-sm/md/lg` are legacy aliases for control/card/soft.) Type floor is
// the xs step (0.8rem / 12.8px); never go below `text-xs`.

interface NavigationItem {
  label: string;
  href: string;
  icon: typeof Gauge;
  children?: NavigationItem[];
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
        label: "Marketplace",
        href: "/marketplace",
        icon: Store,
      },
      {
        label: "Collaborations",
        href: "/collaborations/meeting-schedular",
        icon: Users,
      },
      {
        label: "Projects",
        href: "/marketplace/projects",
        icon: FolderKanban,
      },
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
      {
        label: "Feedback",
        href: "/feedback",
        icon: MessageSquare,
      },
    ],
  },
];

const COLLAPSE_KEY = "flonion:sidebar-collapsed:v1";

function useCollapsed() {
  const [collapsed, setCollapsed] = createSignal(false);
  onMount(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Private mode — default to expanded.
    }
  });
  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        // Ignore storage failures.
      }
      return !v;
    });
  };
  return [collapsed, toggle] as const;
}

export function Brand(props: { collapsed?: boolean }) {
  const { businessName } = useSettings();

  return (
    <div class="w-full">
      {/* Flonion logo */}
      <div
        class={`flex items-center ${props.collapsed ? "justify-center" : ""}`}
      >
        <InlineCombinationMark class="h-6 w-auto shrink-0" aria-hidden="true" />
      </div>

      {/* Divider */}
      <div class="my-3 h-px w-full bg-border short:my-2" />

      {/* Business name — hidden in rail mode (tooltip carries it). */}
      <Show when={!props.collapsed && businessName()}>
        <h1 class="truncate font-heading text-xl font-semibold leading-tight text-foreground">
          {businessName()}
        </h1>
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

  const email = createMemo(() => session()?.data?.user?.email || "");

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

  // Rail mode: avatar only (menu still reachable, 44px target).
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={displayName()}
        title={props.collapsed ? displayName() : undefined}
        class={`flex w-full items-center gap-3 rounded-sm bg-muted/60 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          props.collapsed ? "justify-center px-0 py-2" : "px-3 py-3 short:py-2"
        }`}
      >
        {/* Avatar */}
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
          aria-hidden="true"
        >
          {initials()}
        </div>

        {/* User details */}
        <Show when={!props.collapsed}>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium leading-tight text-foreground">
              {displayName()}
            </p>

            <Show when={email()}>
              <p class="mt-1 truncate text-xs leading-tight text-muted-foreground">
                {email()}
              </p>
            </Show>
          </div>

          {/* Dropdown indicator */}
          <ChevronDown
            class="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Show>
      </Menu.Trigger>

      <Menu.Positioner>
        <Menu.Content class="min-w-55 rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <Menu.Item
            value="account-settings"
            class="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onSelect={() => navigate("/account")}
          >
            <User class="size-4 shrink-0" aria-hidden="true" />
            Account Settings
          </Menu.Item>

          <Menu.Separator class="my-1 h-px bg-border" />

          <Menu.Item
            value="logout"
            class="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
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

export function NavigationContent(props: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const location = useLocation();
  const collapsed = () => props.collapsed === true;

  return (
    <nav aria-label="Primary navigation" class="space-y-7 short:space-y-4">
      <For each={navigationGroups}>
        {(group) => {
          const headingId = `navigation-${group.label
            .toLowerCase()
            .replace(/\s+/g, "-")}`;

          return (
            <section aria-labelledby={headingId}>
              {/* Section heading — sr-only in rail mode. */}
              <h2
                id={headingId}
                class={
                  collapsed()
                    ? "sr-only"
                    : "mb-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground short:mb-2"
                }
              >
                {group.label}
              </h2>
              <Show when={collapsed()}>
                <div class="mx-2 mb-2 h-px bg-border" aria-hidden="true" />
              </Show>

              {/* Navigation items */}
              <ul class="space-y-2 short:space-y-1">
                <For each={group.items}>
                  {(item) => {
                    const Icon = item.icon;

                    const isActive = createMemo(
                      () =>
                        location.pathname === item.href ||
                        location.pathname.startsWith(`${item.href}/`),
                    );

                    return (
                      <li>
                        <A
                          href={item.href}
                          onClick={props.onNavigate}
                          title={collapsed() ? item.label : undefined}
                          activeClass="bg-primary/10 text-primary"
                          inactiveClass="text-muted-foreground hover:bg-muted hover:text-foreground"
                          class={`group flex w-full items-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                            collapsed()
                              ? "min-h-11 min-w-11 justify-center px-0 py-2.5"
                              : "px-3 py-2.5 short:py-2"
                          }`}
                          aria-current={isActive() ? "page" : undefined}
                        >
                          <Icon class="size-5 shrink-0" aria-hidden="true" />

                          <Show when={!collapsed()}>
                            <span class="ml-4 truncate">{item.label}</span>
                          </Show>
                        </A>

                        {/* Nested children — expanded mode only. */}
                        <Show
                          when={
                            !collapsed() &&
                            item.children &&
                            item.children.length > 0
                          }
                        >
                          <ul class="mt-1 ml-6 space-y-1 short:space-y-0.5">
                            <For each={item.children ?? []}>
                              {(child) => {
                                const ChildIcon = child.icon;
                                const isChildActive = createMemo(
                                  () =>
                                    location.pathname === child.href ||
                                    location.pathname.startsWith(
                                      `${child.href}/`,
                                    ),
                                );
                                return (
                                  <li>
                                    <A
                                      href={child.href}
                                      onClick={props.onNavigate}
                                      activeClass="bg-primary/10 text-primary"
                                      inactiveClass="text-muted-foreground hover:bg-muted hover:text-foreground"
                                      class="group flex w-full items-center rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary short:py-1.5"
                                      aria-current={
                                        isChildActive() ? "page" : undefined
                                      }
                                    >
                                      <ChildIcon
                                        class="size-5 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span class="ml-3 truncate">
                                        {child.label}
                                      </span>
                                    </A>
                                  </li>
                                );
                              }}
                            </For>
                          </ul>
                        </Show>
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
  const [collapsed, toggle] = useCollapsed();

  return (
    <aside
      aria-label="Application sidebar"
      class={`hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-background lg:flex ${
        collapsed() ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Header */}
      <header
        class={`shrink-0 pt-5 short:pt-4 ${collapsed() ? "px-3" : "px-6"}`}
      >
        <Brand collapsed={collapsed()} />
      </header>

      {/* Navigation — px-3 pairs with the inner px-3 on headings/links so
          icons and headings sit on the same 24px gutter as the brand above. */}
      <div
        id="sidebar-navigation"
        class={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-6 short:py-3 ${
          collapsed() ? "px-2" : "px-3"
        }`}
      >
        <NavigationContent collapsed={collapsed()} />
      </div>

      {/* Collapse toggle + profile — px-3 keeps the toggle icon and the
          profile avatar on the same 24px gutter as the brand and nav. */}
      <footer
        class={`shrink-0 space-y-3 pb-5 short:pb-4 ${
          collapsed() ? "px-2" : "px-3"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed()}
          aria-controls="sidebar-navigation"
          title={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
          class={`flex min-h-11 w-full items-center gap-3 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            collapsed() ? "justify-center px-0" : "px-3"
          }`}
        >
          <Show
            when={collapsed()}
            fallback={<ChevronsLeft aria-hidden="true" />}
          >
            <ChevronsRight aria-hidden="true" />
          </Show>
          <Show when={!collapsed()}>
            <span>Collapse</span>
          </Show>
        </button>
        <ProfileSummary collapsed={collapsed()} />
      </footer>
    </aside>
  );
}
