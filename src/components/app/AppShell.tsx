import { Dialog } from "@ark-ui/solid/dialog";
import { Menu } from "@ark-ui/solid/menu";
import {
  A,
  createAsync,
  revalidate,
  useLocation,
  useNavigate,
} from "@solidjs/router";
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceDesktop,
  IconDots,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMoon,
  IconRocket,
  IconSelector,
  IconSun,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createEffect,
  createSignal,
  ErrorBoundary,
  For,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import Logomark from "~/assets/logomark";
import { AppProvider, useApp } from "~/components/app/context";
import {
  MOBILE_TABS,
  NAV_ACCOUNT,
  NAV_GROUPS,
  type NavItem,
  profileHref,
} from "~/components/app/nav";
import { focusRing } from "~/components/auth/AuthShell";
import { WidgetError } from "~/components/dashboard/ui";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { getImpersonation } from "~/lib/impersonation";
import { PLANS, type PlanId, planName } from "~/lib/plans";

const UPGRADE_HREF = "/upgrade";

/**
 * The business's plan for the shell chrome. `.latest` so the sidebar never
 * suspends; Starter until the business has loaded.
 */
function useCurrentPlan(): () => PlanId {
  const { business } = useApp();
  return () => business.latest?.plan ?? "starter";
}

const COLLAPSE_KEY = "flonion:sidebar-collapsed";
const THEME_KEY = "flonion:theme";

type Theme = "system" | "light" | "dark";
const THEMES: Array<{ value: Theme; label: string; icon: typeof IconSun }> = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "System", icon: IconDeviceDesktop },
];

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/**
 * App interior follows the OS light/dark preference unless the user picks one
 * (spec §1 Section rhythm). The class lives on <html> so the body canvas
 * changes too, and is removed on unmount so marketing pages stay light.
 */
function createTheme() {
  const [theme, setThemeSignal] = createSignal<Theme>("system");

  onMount(() => {
    const stored = readStorage(THEME_KEY);
    if (stored === "light" || stored === "dark") setThemeSignal(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        theme() === "dark" || (theme() === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    createEffect(apply);
    media.addEventListener("change", apply);
    onCleanup(() => {
      media.removeEventListener("change", apply);
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "";
    });
  });

  const setTheme = (next: Theme) => {
    setThemeSignal(next);
    writeStorage(THEME_KEY, next);
  };
  const cycle = () => {
    const order: Theme[] = ["system", "light", "dark"];
    setTheme(order[(order.indexOf(theme()) + 1) % order.length]);
  };

  return { theme, setTheme, cycle };
}

function isActive(pathname: string, href: string, end?: boolean) {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

async function logOut() {
  await authClient.signOut().catch(() => {});
  window.location.assign("/login");
}

export function AppShell(props: { children: JSX.Element }) {
  return (
    <AppProvider>
      <Shell>{props.children}</Shell>
    </AppProvider>
  );
}

function Shell(props: { children: JSX.Element }) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const { theme, setTheme, cycle } = createTheme();
  const location = useLocation();
  const plan = useCurrentPlan();
  /** Nothing to upsell once the business is on the top plan. */
  const canUpgrade = () => plan() !== PLANS[PLANS.length - 1].id;

  onMount(() => setCollapsed(readStorage(COLLAPSE_KEY) === "1"));

  const toggleCollapsed = () => {
    const next = !collapsed();
    setCollapsed(next);
    writeStorage(COLLAPSE_KEY, next ? "1" : "0");
  };

  // Close the drawer after navigating from it.
  createEffect(
    on(
      () => location.pathname,
      () => setMoreOpen(false),
      { defer: true },
    ),
  );

  return (
    <div class="min-h-dvh bg-background text-text">
      <a
        href="#app-main"
        class={cn(
          "sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]",
          focusRing,
        )}
      >
        Skip to content
      </a>

      {/*
        Desktop sidebar: pinned to the viewport (never taller than the screen),
        248px wide, collapsible to 64px. Only the nav list scrolls.
      */}
      <aside
        class={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none md:flex",
          collapsed() ? "w-16" : "w-[248px]",
        )}
      >
        <div
          class={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed() ? "justify-center px-2" : "justify-between pr-2 pl-5",
          )}
        >
          <A
            href="/dashboard"
            class={cn("flex min-h-11 items-center rounded-md", focusRing)}
          >
            <Show when={!collapsed()} fallback={<Logomark class="size-9" />}>
              <InlineCombinationMark class="h-[22px] w-auto" />
            </Show>
            <span class="sr-only">Flonion dashboard</span>
          </A>
          <Show when={!collapsed()}>
            <CollapseButton collapsed={false} onClick={toggleCollapsed} />
          </Show>
        </div>

        <nav
          aria-label="App"
          class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
        >
          <Show when={collapsed()}>
            <div class="mb-2 flex justify-center">
              <CollapseButton collapsed onClick={toggleCollapsed} />
            </div>
          </Show>
          <NavList pathname={location.pathname} collapsed={collapsed()} />
        </nav>

        <div class="flex shrink-0 flex-col gap-2 border-t border-border p-3">
          <Show when={canUpgrade()}>
            <UpgradeLink
              collapsed={collapsed()}
              active={isActive(location.pathname, UPGRADE_HREF)}
            />
          </Show>
          <AccountMenu
            collapsed={collapsed()}
            canUpgrade={canUpgrade()}
            theme={theme()}
            onTheme={setTheme}
          />
        </div>
      </aside>

      <div
        class={cn(
          "flex min-h-dvh min-w-0 flex-col transition-[padding] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none",
          collapsed() ? "md:pl-16" : "md:pl-[248px]",
        )}
      >
        <Suspense>
          <ImpersonationBanner />
        </Suspense>

        {/* Mobile top bar */}
        <header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
          <A
            href="/dashboard"
            class={cn("flex min-h-11 items-center rounded-md", focusRing)}
          >
            <InlineCombinationMark class="h-5 w-auto" />
            <span class="sr-only">Flonion dashboard</span>
          </A>
          <div class="flex items-center gap-1">
            <Show when={canUpgrade()}>
              <A
                href={UPGRADE_HREF}
                aria-current={
                  isActive(location.pathname, UPGRADE_HREF) ? "page" : undefined
                }
                class={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-display text-sm font-semibold text-primary hover:bg-primary-soft aria-[current=page]:bg-primary-soft",
                  focusRing,
                )}
              >
                <IconRocket aria-hidden="true" class="size-4" />
                Upgrade
              </A>
            </Show>
            <button
              type="button"
              onClick={cycle}
              aria-label={`Theme: ${theme()}. Activate to change`}
              class={cn(
                "grid size-11 place-items-center rounded-md text-text-muted hover:bg-primary-soft hover:text-text",
                focusRing,
              )}
            >
              <Dynamic
                component={
                  THEMES.find((t) => t.value === theme())?.icon ??
                  IconDeviceDesktop
                }
                aria-hidden="true"
                class="size-5"
              />
            </button>
          </div>
        </header>

        <main
          id="app-main"
          tabindex="-1"
          class="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-28 outline-none md:px-6 md:pt-8 md:pb-12"
        >
          {/* One page-level net so a route's failed data keeps the shell
              chrome usable instead of blanking the whole app. Widgets that
              want finer-grained recovery add their own boundary inside. */}
          <ErrorBoundary
            fallback={(_err, reset) => (
              <WidgetError
                what="this page"
                onRetry={() => {
                  void revalidate(undefined);
                  reset();
                }}
              />
            )}
          >
            {/* The loading counterpart of the net above. Without it, any page
                that suspends outside a navigation transition (a fetch started
                in onMount, say) reaches the router-root <Suspense> in app.tsx,
                which has no fallback, and the sidebar blanks with the page. */}
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="App"
        class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul class="grid grid-cols-5">
          <For each={MOBILE_TABS}>
            {(item) => {
              const active = () =>
                isActive(location.pathname, item.href, item.end);
              return (
                <li>
                  <A
                    href={item.href}
                    aria-current={active() ? "page" : undefined}
                    class={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium",
                      active() ? "text-primary" : "text-text-muted",
                      focusRing,
                      "focus-visible:-outline-offset-2",
                    )}
                  >
                    <item.icon aria-hidden="true" class="size-5" />
                    <span class="max-w-full truncate">{item.label}</span>
                  </A>
                </li>
              );
            }}
          </For>
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              class={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-text-muted",
                focusRing,
                "focus-visible:-outline-offset-2",
              )}
            >
              <IconDots aria-hidden="true" class="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <MoreDrawer
        open={moreOpen()}
        onClose={() => setMoreOpen(false)}
        pathname={location.pathname}
      />
    </div>
  );
}

function navItemClass(active: boolean, collapsed: boolean) {
  return cn(
    "group flex min-h-10 w-full items-center gap-3 rounded-md text-sm transition-colors duration-[var(--duration-fast)]",
    collapsed ? "justify-center px-0" : "px-3",
    active
      ? "bg-primary-soft font-medium text-primary"
      : "text-text hover:bg-background",
    focusRing,
    "focus-visible:outline-offset-0",
  );
}

function NavLink(props: {
  item: NavItem;
  /** Null while the shell is still resolving a dynamic target. */
  href: string | null;
  active: boolean;
  collapsed: boolean;
}) {
  const body = () => (
    <>
      <props.item.icon
        aria-hidden="true"
        stroke-width={props.active ? 2 : 1.75}
        class={cn(
          "size-5 shrink-0",
          props.active
            ? "text-primary"
            : "text-text-muted group-hover:text-text",
        )}
      />
      <span class={cn("truncate", props.collapsed && "sr-only")}>
        {props.item.label}
      </span>
    </>
  );

  // Rendered as a non-link rather than hidden, so the sidebar doesn't reflow
  // the moment the business resolves.
  return (
    <Show
      when={props.href}
      fallback={
        <span
          aria-disabled="true"
          title={props.collapsed ? props.item.label : undefined}
          class={cn(navItemClass(false, props.collapsed), "opacity-60")}
        >
          {body()}
        </span>
      }
    >
      {(href) => (
        <A
          href={href()}
          aria-current={props.active ? "page" : undefined}
          title={props.collapsed ? props.item.label : undefined}
          class={navItemClass(props.active, props.collapsed)}
        >
          {body()}
        </A>
      )}
    </Show>
  );
}

function NavList(props: { pathname: string; collapsed: boolean }) {
  const { business } = useApp();

  /** Dynamic entries (the owner's own profile) resolve against the business. */
  const hrefFor = (item: NavItem) =>
    item.dynamic === "profile" ? profileHref(business.latest) : item.href;

  return (
    <div class="flex flex-col gap-4">
      <For each={NAV_GROUPS}>
        {(group) => (
          <div class="flex flex-col gap-1">
            <Show when={group.label}>
              <Show
                when={!props.collapsed}
                fallback={
                  <div aria-hidden="true" class="mx-2 mb-1 h-px bg-border" />
                }
              >
                <p class="px-3 pb-0.5 font-display text-xs font-medium tracking-wider text-text-muted uppercase">
                  {group.label}
                </p>
              </Show>
            </Show>
            <ul class="flex flex-col gap-0.5">
              <For each={group.items}>
                {(item) => {
                  const href = () => hrefFor(item);
                  return (
                    <li>
                      <NavLink
                        item={item}
                        href={href()}
                        active={Boolean(
                          href() && isActive(props.pathname, href()!, item.end),
                        )}
                        collapsed={props.collapsed}
                      />
                    </li>
                  );
                }}
              </For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );
}

function CollapseButton(props: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!props.collapsed}
      title={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
      class={cn(
        "grid size-10 place-items-center rounded-md text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-background hover:text-text",
        focusRing,
      )}
    >
      <Show
        when={props.collapsed}
        fallback={
          <IconLayoutSidebarLeftCollapse
            aria-hidden="true"
            stroke-width={1.75}
            class="size-5"
          />
        }
      >
        <IconLayoutSidebarLeftExpand
          aria-hidden="true"
          stroke-width={1.75}
          class="size-5"
        />
      </Show>
    </button>
  );
}

/**
 * Plan upsell above the account menu: always one glance away, but a tint
 * rather than a filled button so it never competes with the page's own
 * primary action.
 */
function UpgradeLink(props: { collapsed: boolean; active: boolean }) {
  const plan = useCurrentPlan();
  return (
    <A
      href={UPGRADE_HREF}
      aria-current={props.active ? "page" : undefined}
      title={props.collapsed ? "Upgrade plan" : undefined}
      class={cn(
        "flex items-center rounded-md bg-primary-soft text-primary transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft/70 aria-[current=page]:ring-1 aria-[current=page]:ring-primary aria-[current=page]:ring-inset",
        props.collapsed
          ? "size-10 justify-center self-center"
          : "min-h-12 gap-2.5 px-2 py-1.5",
        focusRing,
        "focus-visible:outline-offset-0",
      )}
    >
      <span
        aria-hidden="true"
        class={cn(
          "grid shrink-0 place-items-center rounded-md",
          !props.collapsed && "size-9 bg-primary text-primary-foreground",
        )}
      >
        <IconRocket stroke-width={1.75} class="size-5" />
      </span>
      <Show
        when={!props.collapsed}
        fallback={<span class="sr-only">Upgrade plan</span>}
      >
        <span class="flex min-w-0 flex-col">
          <span class="truncate font-display text-sm font-semibold">
            Upgrade plan
          </span>
          <span class="truncate text-xs text-text-muted">
            You're on {planName(plan())}
          </span>
        </span>
      </Show>
    </A>
  );
}

/** Square business mark: the uploaded logo, or its initial on the tint. */
function BusinessMark(props: { class?: string }) {
  const { business } = useApp();
  // `.latest` rather than `business()`: the shell must not suspend and blank
  // its own chrome while a revalidation is in flight. `deferStream` on the
  // provider means the value is already in the first HTML.
  const info = () => business.latest;
  return (
    <Show
      when={info()}
      fallback={
        <span
          aria-hidden="true"
          class={cn(
            "block shrink-0 rounded-md bg-primary-soft motion-safe:animate-pulse",
            props.class,
          )}
        />
      }
    >
      {(b) => (
        <Show
          when={b().logo}
          fallback={
            <span
              aria-hidden="true"
              class={cn(
                "grid shrink-0 place-items-center rounded-md bg-primary font-display text-sm font-semibold text-primary-foreground",
                props.class,
              )}
            >
              {(b().businessName || "?").charAt(0).toUpperCase()}
            </span>
          }
        >
          {(logo) => (
            <img
              src={logo()}
              alt=""
              class={cn("shrink-0 rounded-md object-cover", props.class)}
            />
          )}
        </Show>
      )}
    </Show>
  );
}

/** Business name and the user's role; used by the account menu and drawer. */
function BusinessLabel() {
  const { business } = useApp();
  // `.latest` rather than `business()`: the shell must not suspend and blank
  // its own chrome while a revalidation is in flight. `deferStream` on the
  // provider means the value is already in the first HTML.
  const info = () => business.latest;
  return (
    <Show
      when={info()}
      fallback={
        <span class="flex flex-1 flex-col gap-1.5" aria-hidden="true">
          <span class="block h-3 w-3/4 rounded-sm bg-primary-soft motion-safe:animate-pulse" />
          <span class="block h-2.5 w-1/3 rounded-sm bg-primary-soft/70 motion-safe:animate-pulse" />
        </span>
      }
    >
      {(b) => (
        <span class="flex min-w-0 flex-1 flex-col text-left">
          <span class="truncate font-display text-sm font-semibold text-text">
            {b().businessName || "Your business"}
          </span>
          <span class="truncate text-xs text-text-muted capitalize">
            {b().isOwner ? "Owner" : b().role}
          </span>
        </span>
      )}
    </Show>
  );
}

const menuItemClass =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm text-text outline-none data-[highlighted]:bg-primary-soft";

/**
 * Account, feedback, theme and log out live behind one trigger so the main
 * nav keeps the sidebar's height for the pages owners use daily.
 */
function AccountMenu(props: {
  collapsed: boolean;
  /** False on the top plan, where there is nothing left to upsell. */
  canUpgrade: boolean;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const plan = useCurrentPlan();

  return (
    <Menu.Root
      positioning={{
        placement: props.collapsed ? "right-end" : "top-start",
        gutter: 8,
        sameWidth: !props.collapsed,
      }}
      onSelect={(details) => {
        if (details.value === "logout") return void logOut();
        if (details.value.startsWith("/")) navigate(details.value);
      }}
    >
      <Menu.Trigger
        title={props.collapsed ? "Account menu" : undefined}
        class={cn(
          "flex min-h-12 w-full items-center gap-2.5 rounded-md text-left transition-colors duration-[var(--duration-fast)] hover:bg-background data-[state=open]:bg-background",
          props.collapsed ? "justify-center p-1" : "px-2 py-1.5",
          focusRing,
          "focus-visible:outline-offset-0",
        )}
      >
        <BusinessMark class="size-9" />
        <Show
          when={!props.collapsed}
          fallback={<span class="sr-only">Account menu</span>}
        >
          <BusinessLabel />
          <IconSelector
            aria-hidden="true"
            class="size-4 shrink-0 text-text-muted"
          />
        </Show>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class="w-[max(var(--reference-width),14rem)] rounded-md border border-border bg-surface p-1 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
            <Show when={session().data?.user}>
              {(user) => (
                <>
                  <div class="px-2.5 pt-1.5 pb-2">
                    <p class="truncate text-sm font-medium">{user().name}</p>
                    <p class="truncate text-xs text-text-muted">
                      {user().email}
                    </p>
                  </div>
                  <Menu.Separator class="my-1 h-px border-0 bg-border" />
                </>
              )}
            </Show>
            <Show when={props.canUpgrade}>
              <Menu.Item
                value={UPGRADE_HREF}
                class={cn(menuItemClass, "font-medium text-primary")}
              >
                <IconRocket
                  aria-hidden="true"
                  stroke-width={1.75}
                  class="size-4"
                />
                <span class="flex-1">Upgrade plan</span>
                <span class="text-xs font-normal text-text-muted">
                  {planName(plan())}
                </span>
              </Menu.Item>
              <Menu.Separator class="my-1 h-px border-0 bg-border" />
            </Show>
            <For each={NAV_ACCOUNT}>
              {(item) => (
                <Menu.Item value={item.href} class={menuItemClass}>
                  <item.icon
                    aria-hidden="true"
                    stroke-width={1.75}
                    class="size-4 text-text-muted"
                  />
                  {item.label}
                </Menu.Item>
              )}
            </For>
            <Menu.Separator class="my-1 h-px border-0 bg-border" />
            <Menu.RadioItemGroup
              value={props.theme}
              onValueChange={(e) => props.onTheme(e.value as Theme)}
            >
              <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                Theme
              </Menu.ItemGroupLabel>
              <For each={THEMES}>
                {(t) => (
                  <Menu.RadioItem value={t.value} class={menuItemClass}>
                    <t.icon
                      aria-hidden="true"
                      stroke-width={1.75}
                      class="size-4 text-text-muted"
                    />
                    <Menu.ItemText class="flex-1">{t.label}</Menu.ItemText>
                    <Menu.ItemIndicator class="text-primary">
                      <IconCheck aria-hidden="true" class="size-4" />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
            <Menu.Separator class="my-1 h-px border-0 bg-border" />
            <Menu.Item value="logout" class={menuItemClass}>
              <IconLogout
                aria-hidden="true"
                stroke-width={1.75}
                class="size-4 text-text-muted"
              />
              Log out
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

/** Persistent warning bar on every app page while an operator impersonates. */
function ImpersonationBanner() {
  const who = createAsync(() => getImpersonation(), { deferStream: false });
  return (
    <Show when={who()}>
      {(w) => (
        <div
          role="status"
          class="sticky top-0 z-40 flex min-h-11 items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-background"
        >
          <IconAlertTriangle aria-hidden="true" class="size-4 shrink-0" />
          <span>
            You are viewing as <strong>{w().name}</strong>
          </span>
          <a
            href="/api/operator/stop-impersonation"
            rel="external"
            class={cn(
              "ml-2 inline-flex min-h-9 items-center rounded-sm px-2 underline underline-offset-4",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background",
            )}
          >
            Stop
          </a>
        </div>
      )}
    </Show>
  );
}

function MoreDrawer(props: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0 md:hidden" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end md:hidden">
          <Dialog.Content class="flex max-h-[85dvh] w-full flex-col rounded-t-xl bg-surface text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:slide-in-from-bottom-8">
            <div class="flex items-center gap-3 border-b border-border py-2 pr-2 pl-4">
              <BusinessMark class="size-9" />
              <Dialog.Title class="flex min-w-0 flex-1">
                <BusinessLabel />
              </Dialog.Title>
              <Dialog.CloseTrigger
                aria-label="Close menu"
                class={cn(
                  "grid size-11 place-items-center rounded-md text-text-muted hover:bg-background",
                  focusRing,
                )}
              >
                <IconX aria-hidden="true" class="size-5" />
              </Dialog.CloseTrigger>
            </div>
            <div class="overflow-y-auto px-3 py-3 [&_a]:min-h-11">
              <NavList pathname={props.pathname} collapsed={false} />
              <div aria-hidden="true" class="mx-2 my-4 h-px bg-border" />
              <ul class="flex flex-col gap-0.5">
                <For each={NAV_ACCOUNT}>
                  {(item) => (
                    <li>
                      <NavLink
                        item={item}
                        href={item.href}
                        active={isActive(props.pathname, item.href, item.end)}
                        collapsed={false}
                      />
                    </li>
                  )}
                </For>
                <li>
                  <button
                    type="button"
                    onClick={logOut}
                    class={cn(navItemClass(false, false), "min-h-11")}
                  >
                    <IconLogout
                      aria-hidden="true"
                      stroke-width={1.75}
                      class="size-5 shrink-0 text-text-muted"
                    />
                    Log out
                  </button>
                </li>
              </ul>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
