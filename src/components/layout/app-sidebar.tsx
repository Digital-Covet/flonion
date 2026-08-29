import ChevronDown from "lucide-solid/icons/chevron-down";
import ChevronRight from "lucide-solid/icons/chevron-right";
import LogOut from "lucide-solid/icons/log-out";
import BarChart3 from "lucide-solid/icons/bar-chart-3";
import Gauge from "lucide-solid/icons/gauge";
import Inbox from "lucide-solid/icons/inbox";
import Megaphone from "lucide-solid/icons/megaphone";
import PenSquare from "lucide-solid/icons/pen-square";
import SearchCheck from "lucide-solid/icons/search-check";
import FolderKanban from "lucide-solid/icons/folder-kanban";
import Store from "lucide-solid/icons/store";
import Users from "lucide-solid/icons/users";
import MessageSquare from "lucide-solid/icons/message-square";
import Settings from "lucide-solid/icons/settings";
import User from "lucide-solid/icons/user";
import UserCircle from "lucide-solid/icons/user-circle";

import { Menu } from "@ark-ui/solid/menu";
import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  For,
  Show,
  createMemo,
} from "solid-js";

import InlineCombinationMark from "@/assets/inline-combination-mark";
import { authClient } from "~/lib/auth-client";
import { useSettings } from "~/stores/settings-store";

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
        href: "/marketplace/collaborations/meeting-schedular",
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

export function Brand() {
  const { businessName } = useSettings();

  return (
    <div class="w-full">
      {/* Flonion logo */}
      <div class="flex items-center">
        <InlineCombinationMark
          class="h-6 w-auto shrink-0"
          aria-hidden="true"
        />
      </div>

      {/* Divider */}
      <div class="my-3 h-px w-full bg-border short:my-2" />

      {/* Business name */}
      <Show when={businessName()}>
        <h1 class="truncate text-xl font-semibold leading-tight tracking-tight text-foreground">
          {businessName()}
        </h1>
      </Show>
    </div>
  );
}

export function ProfileSummary() {
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
        class="flex w-full items-center gap-3 rounded-xl bg-muted/60 px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring short:py-2"
        aria-label={displayName()}
      >
        {/* Avatar */}
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {initials()}
        </div>

        {/* User details */}
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-semibold leading-tight text-foreground">
            {displayName()}
          </p>

          <Show when={email()}>
            <p class="mt-1 truncate text-sm leading-tight text-muted-foreground">
              {email()}
            </p>
          </Show>
        </div>

        {/* Dropdown indicator */}
        <ChevronDown
          class="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Menu.Trigger>

      <Menu.Positioner>
        <Menu.Content class="min-w-55 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <Menu.Item
            value="account-settings"
            class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onSelect={() => navigate("/account")}
          >
            <User
              class="size-4 shrink-0"
              aria-hidden="true"
            />
            Account Settings
          </Menu.Item>

          <Menu.Separator class="my-1 h-px bg-border" />

          <Menu.Item
            value="logout"
            class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onSelect={handleLogout}
          >
            <LogOut
              class="size-4 shrink-0"
              aria-hidden="true"
            />
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
  },
) {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary navigation"
      class="space-y-7 short:space-y-4"
    >
      <For each={navigationGroups}>
        {(group) => {
          const headingId = `navigation-${group.label
            .toLowerCase()
            .replace(/\s+/g, "-")}`;

          return (
            <section
              aria-labelledby={headingId}
            >
              {/* Section heading */}
              <h2
                id={headingId}
                class="mb-3 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground short:mb-2"
              >
                {group.label}
              </h2>

              {/* Navigation items */}
              <ul class="space-y-2 short:space-y-1">
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
                          class="group flex w-full items-center rounded-full px-4 py-2.5 text-base font-medium transition-colors short:py-2"
                          aria-current={
                            isActive()
                              ? "page"
                              : undefined
                          }
                        >
                          <Icon
                            class="size-6 shrink-0"
                            aria-hidden="true"
                          />

                          <span class="ml-4 truncate">
                            {item.label}
                          </span>

                          {/* Arrow only on active item */}
                          <Show when={isActive()}>
                            <ChevronRight
                              class="ml-auto size-6 shrink-0"
                              aria-hidden="true"
                            />
                          </Show>
                        </A>

                        {/* Nested children */}
                        <Show when={item.children && item.children.length > 0}>
                          <ul class="mt-1 ml-6 space-y-1 short:space-y-0.5">
                            <For each={item.children}>
                              {(child) => {
                                const ChildIcon = child.icon;
                                const isChildActive = createMemo(
                                  () =>
                                    location.pathname === child.href ||
                                    location.pathname.startsWith(`${child.href}/`),
                                );
                                return (
                                  <li>
                                    <A
                                      href={child.href}
                                      onClick={props.onNavigate}
                                      activeClass="bg-primary/10 text-primary"
                                      inactiveClass="text-muted-foreground hover:bg-muted hover:text-foreground"
                                      class="group flex w-full items-center rounded-full px-3 py-2 text-sm font-medium transition-colors short:py-1.5"
                                      aria-current={isChildActive() ? "page" : undefined}
                                    >
                                      <ChildIcon class="size-5 shrink-0" aria-hidden="true" />
                                      <span class="ml-3 truncate">{child.label}</span>
                                      <Show when={isChildActive()}>
                                        <ChevronRight class="ml-auto size-5 shrink-0" aria-hidden="true" />
                                      </Show>
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
  return (
    <aside
      class="hidden h-full w-80 shrink-0 flex-col overflow-hidden border-r border-border bg-background lg:flex"
      aria-label="Application sidebar"
    >
      {/* Header */}
      <header class="shrink-0 px-8 pt-5 short:pt-4">
        <Brand />
      </header>

      {/* Navigation */}
      <div
        id="sidebar-navigation"
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6 short:py-3"
      >
        <NavigationContent />
      </div>

      {/* Profile */}
      <footer class="shrink-0 px-8 pb-5 short:pb-4">
        <ProfileSummary />
      </footer>
    </aside>
  );
}
