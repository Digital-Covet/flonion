# Directory Structure
```
src/assets/logo.tsx
src/components/layout/app-sidebar.tsx
src/lib/auth-client.ts
src/stores/settings-store.ts
```

# Files

## File: src/assets/logo.tsx
```typescript
import type { JSX } from "solid-js";
const LogoComponent = (props: JSX.GSVGAttributes<SVGSVGElement>) => (
	<svg
		data-name="Layer 1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="70 390 980 320"
		{...props}
	>
		<title>Digital Covet Logo</title>
	</svg>
);
export default LogoComponent;
```

## File: src/lib/auth-client.ts
```typescript
import { createAuthClient } from "better-auth/solid";
import { emailOTPClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
  baseURL: "http://localhost:5173",
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
  ],
});
```

## File: src/stores/settings-store.ts
```typescript
import { createContext, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";
export interface SettingsData {
  placeId: string;
  logo: string | null;
  businessName: string;
  phone: string;
  address: string;
}
export interface SettingsContextValue {
  placeId: Accessor<string>;
  setPlaceId: Setter<string>;
  logo: Accessor<string | null>;
  setLogo: Setter<string | null>;
  businessName: Accessor<string>;
  setBusinessName: Setter<string>;
  phone: Accessor<string>;
  setPhone: Setter<string>;
  address: Accessor<string>;
  setAddress: Setter<string>;
}
export const SettingsContext = createContext<SettingsContextValue>();
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
```

## File: src/components/layout/app-sidebar.tsx
```typescript
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import Gauge from "lucide-solid/icons/gauge";
import Inbox from "lucide-solid/icons/inbox";
import Megaphone from "lucide-solid/icons/megaphone";
import PenSquare from "lucide-solid/icons/pen-square";
import SearchCheck from "lucide-solid/icons/search-check";
import Settings from "lucide-solid/icons/settings";
import { A, useLocation } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";
import { useSettings } from "~/stores/settings-store";
import { authClient } from "~/lib/auth-client";
import LogoComponent from "~/assets/logo";
const SIDEBAR_COLLAPSED_KEY = "revme-sidebar-collapsed";
function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}
function saveCollapsed(value: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
  } catch {
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
export function Brand(props: { collapsed?: boolean }) {
  const { logo } = useSettings();
  return (
    <div class="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
      <Show when={logo()} fallback={<LogoComponent class="h-8 w-auto shrink-0" />}>
        <img src={logo()!} alt="Agency logo" class="h-8 w-auto shrink-0 object-contain" />
      </Show>
      <Show when={!props.collapsed}>
        <span class="truncate">RevMe</span>
      </Show>
    </div>
  );
}
export function ProfileSummary(props: { collapsed?: boolean }) {
  const session = authClient.useSession();
  const initials = createMemo(() => {
    const name = session()?.data?.user?.name;
    if (!name) return "?";
    return name
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  });
  const displayName = createMemo(() => {
    return session()?.data?.user?.name || session()?.data?.user?.email || "User";
  });
  return (
    <div class="flex items-center gap-3">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        aria-label={`${displayName()} initials`}
      >
        {initials()}
      </div>
      <Show when={!props.collapsed}>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-foreground">{displayName()}</p>
          <p class="truncate text-xs text-muted-foreground">{session()?.data?.user?.email}</p>
        </div>
      </Show>
    </div>
  );
}
export function NavigationContent(props: { onNavigate?: () => void; collapsed?: boolean }) {
  const location = useLocation();
  return (
    <nav aria-label="Primary navigation" class="space-y-6">
      <For each={navigationGroups}>
        {(group) => (
          <section aria-labelledby={`navigation-${group.label}`}>
            <Show when={!props.collapsed}>
              <h2
                id={`navigation-${group.label}`}
                class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {group.label}
              </h2>
            </Show>
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
                        class={`flex items-center rounded-md text-sm font-medium transition-colors ${
                          props.collapsed
                            ? "justify-center px-2 py-2"
                            : "gap-3 px-3 py-2"
                        }`}
                        aria-current={isActive() ? "page" : undefined}
                        title={props.collapsed ? item.label : undefined}
                      >
                        <Icon class="size-4 shrink-0" aria-hidden="true" />
                        <Show when={!props.collapsed}>
                          {item.label}
                        </Show>
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
  const [collapsed, setCollapsed] = createSignal(loadCollapsed());
  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  };
  return (
    <aside
      class={`hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-all duration-300 lg:flex ${
        collapsed() ? "w-16" : "w-64"
      }`}
    >
      <div class={`flex items-center py-5 ${collapsed() ? "justify-center px-2" : "justify-between px-5"}`}>
        <Brand collapsed={collapsed()} />
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed()}
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Show when={collapsed()} fallback={<ChevronLeft class="size-4" aria-hidden="true" />}>
            <ChevronRight class="size-4" aria-hidden="true" />
          </Show>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-3 py-2">
        <NavigationContent collapsed={collapsed()} />
      </div>
      <div class="border-t border-border p-4">
        <ProfileSummary collapsed={collapsed()} />
      </div>
    </aside>
  );
}
```
