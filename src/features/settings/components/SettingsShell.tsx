import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";

export interface SettingsNavItem {
  /** Anchor id on /settings, or the "team" cross-route entry. */
  id: string;
  label: string;
  /** Full href — anchor on /settings, or /settings/team. */
  href: string;
  /** True for the cross-route team entry. */
  route?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: "section-profile",
    label: "Business Profile",
    href: "/settings#section-profile",
  },
  {
    id: "section-integrations",
    label: "Integrations",
    href: "/settings#section-integrations",
  },
  {
    id: "section-review-links",
    label: "Review Links",
    href: "/settings#section-review-links",
  },
  {
    id: "section-preferences",
    label: "Preferences",
    href: "/settings#section-preferences",
  },
  {
    id: "section-keywords",
    label: "Keywords",
    href: "/settings#section-keywords",
  },
  { id: "section-team", label: "Team", href: "/settings/team", route: true },
  {
    id: "section-danger",
    label: "Danger Zone",
    href: "/settings#section-danger",
  },
];

interface SettingsShellProps {
  /** Nav id of the active section (DS §6 shared template). */
  active: string;
  title: string;
  description: string;
  children: JSX.Element;
}

/**
 * Shared settings template (Flonion DS §6: "Settings (Profile / Platforms /
 * Google / Team): shared template: left section nav, list-then-detail on
 * mobile, danger zone ... with confirmation dialogs").
 *
 * Both `/settings` and `/settings/team` render inside this shell so the two
 * pages read as one surface: sticky section nav on desktop, horizontal
 * quick-link chips below `lg`, and a single H1 per page.
 */
export function SettingsShell(props: SettingsShellProps) {
  return (
    <main class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <div class="mx-auto max-w-6xl gap-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside class="mb-6 lg:mb-0" aria-label="Settings sections">
          <nav class="hidden lg:block" aria-label="Settings sections">
            <ul class="sticky top-6 grid gap-1">
              <For each={SETTINGS_NAV}>
                {(item) => (
                  <li>
                    <A
                      href={item.href}
                      aria-current={
                        item.id === props.active ? "location" : undefined
                      }
                      class={`flex min-h-11 items-center rounded-control px-3 py-2 text-sm font-medium transition-opacity duration-[180ms] motion-reduce:transition-none ${
                        item.id === props.active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </nav>
          {/* List-then-detail on mobile: quick links scroll horizontally. */}
          <nav class="lg:hidden" aria-label="Settings sections">
            <ul class="flex gap-2 overflow-x-auto pb-1">
              <For each={SETTINGS_NAV}>
                {(item) => (
                  <li class="shrink-0">
                    <A
                      href={item.href}
                      aria-current={
                        item.id === props.active ? "location" : undefined
                      }
                      class={`inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-opacity duration-[180ms] motion-reduce:transition-none ${
                        item.id === props.active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {item.label}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </nav>
        </aside>

        <div class="max-w-4xl">
          <div class="mb-6 sm:mb-8">
            <h1 class="font-heading text-3xl font-semibold text-foreground">
              {props.title}
            </h1>
            <p class="mt-1 text-base text-muted-foreground">
              {props.description}
            </p>
          </div>
          <Show when={props.children}>{props.children}</Show>
        </div>
      </div>
    </main>
  );
}
