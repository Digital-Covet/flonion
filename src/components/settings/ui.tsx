import { A } from "@solidjs/router";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-solidjs";
import { For, type JSX, Show } from "solid-js";
import { focusRing } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { btnPrimary, btnSecondary, Spinner } from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";

/**
 * Settings is one form split into named sections (spec §6: "Left section nav,
 * list-then-detail on mobile"). The section lives in the URL so the Google
 * OAuth round-trip, a reload, or a link from another page all land on the same
 * panel — `/settings` is on the OAuth return allowlist with its query intact.
 */
export const SECTIONS = [
  {
    id: "profile",
    label: "Business profile",
    summary: "Name, sector, contact details",
  },
  {
    id: "link",
    label: "Review link",
    summary: "The address customers scan",
  },
  {
    id: "platforms",
    label: "Review platforms",
    summary: "Where customers post",
  },
  {
    id: "keywords",
    label: "Review settings",
    summary: "Keywords for AI suggestions",
  },
  {
    id: "connections",
    label: "Connections",
    summary: "Google Business Profile",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** One row of a left section nav. `/account` supplies its own three. */
export type NavSection<Id extends string = string> = {
  id: Id;
  label: string;
  summary: string;
};

export function isSectionId(value: string | undefined): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

export const sectionCard =
  "rounded-lg border border-border bg-surface p-5 md:p-6";

/** Sidebar entry and mobile list row share one target size and active style. */
function navItemClass(active: boolean) {
  return cn(
    "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-base transition-colors duration-[var(--duration-fast)]",
    active
      ? "bg-primary-soft font-medium text-primary"
      : "text-text hover:bg-primary-soft/60",
    focusRing,
  );
}

/**
 * Section list. On md+ it is the persistent left nav; below md it is the first
 * half of list-then-detail, so it renders only while no section is open.
 * Generic over the page's own section ids so `/settings` and `/account` share
 * one treatment without sharing a section list.
 */
export function SectionNav<Id extends string>(props: {
  items: readonly NavSection<Id>[];
  /** Names the nav for screen readers, e.g. "Settings sections". */
  label: string;
  current: Id | null;
  onSelect: (id: Id) => void;
  /** Mobile shows a summary line under each label; the sidebar does not. */
  detailed?: boolean;
}) {
  return (
    <nav aria-label={props.label}>
      <ul class="flex flex-col gap-1">
        <For each={props.items}>
          {(section) => {
            const active = () => props.current === section.id;
            return (
              <li>
                <button
                  type="button"
                  aria-current={active() ? "page" : undefined}
                  onClick={() => props.onSelect(section.id)}
                  class={cn(
                    navItemClass(active()),
                    props.detailed && "min-h-14 py-2",
                  )}
                >
                  <span class="min-w-0 flex-1">
                    {section.label}
                    <Show when={props.detailed}>
                      <span class="block text-sm font-normal text-text-muted">
                        {section.summary}
                      </span>
                    </Show>
                  </span>
                  <Show when={props.detailed}>
                    <IconChevronRight
                      aria-hidden="true"
                      class="size-5 shrink-0 text-text-muted"
                    />
                  </Show>
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}

/** Titled panel. The heading takes focus on arrival so keyboard and screen
 * reader users are not left at the top of the nav after choosing a section. */
export function SettingsSection(props: {
  /** Section id; also namespaces the heading id, so it must be unique per page. */
  id: string;
  title: string;
  lead?: string;
  /** Rendered next to the heading, e.g. a "view public page" link. */
  aside?: JSX.Element;
  focusHeading?: boolean;
  children: JSX.Element;
}) {
  const headingId = `settings-${props.id}-title`;
  return (
    <section aria-labelledby={headingId} class={sectionCard}>
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <h2
            id={headingId}
            ref={(el) => {
              if (props.focusHeading) queueMicrotask(() => el.focus());
            }}
            tabindex="-1"
            class="font-display text-lg font-semibold text-text outline-none"
          >
            {props.title}
          </h2>
          <Show when={props.lead}>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              {props.lead}
            </p>
          </Show>
        </div>
        <Show when={props.aside}>{props.aside}</Show>
      </div>
      <div class="mt-6">{props.children}</div>
    </section>
  );
}

/** Back to the section list; only ever shown below md. */
export function BackToSections(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        "-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary md:hidden",
        focusRing,
      )}
    >
      <IconChevronLeft aria-hidden="true" class="size-4" />
      All settings
    </button>
  );
}

/**
 * Save bar for the whole form. `POST /api/business` is an upsert over every
 * field, so one save covers every section rather than pretending each panel
 * saves on its own. It sticks to the bottom of the viewport so the action
 * stays in thumb reach on a phone.
 */
export function SaveBar(props: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
}) {
  return (
    <Show when={props.dirty}>
      <div
        class={cn(
          "sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface px-4 py-3 shadow-[0_8px_24px_rgb(0_0_0/0.12)] md:bottom-4",
          "animate-in fade-in-0 duration-[var(--duration-fast)] motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none",
        )}
      >
        <p class="min-w-0 flex-1 text-sm text-text-muted">
          You have unsaved changes.
        </p>
        <button
          type="button"
          disabled={props.saving}
          onClick={props.onDiscard}
          class={cn(btnSecondary, "min-h-10 px-4 text-sm")}
        >
          Discard
        </button>
        <button
          type="submit"
          disabled={props.saving}
          class={cn(
            btnPrimary,
            "min-h-10 px-4 text-sm disabled:cursor-progress disabled:opacity-80",
          )}
        >
          <Show when={props.saving} fallback="Save changes">
            <Spinner class="size-4" />
            Saving…
          </Show>
        </button>
      </div>
    </Show>
  );
}

/** Loading placeholder shaped like a panel of form fields. */
export function SectionSkeleton(props: { fields?: number }) {
  return (
    <div aria-busy="true" class={sectionCard}>
      <span class="sr-only">Loading your settings…</span>
      <Skeleton class="h-6 w-48" />
      <Skeleton class="mt-2 h-4 w-72 opacity-70" />
      <div class="mt-6 flex flex-col gap-5">
        {Array.from({ length: props.fields ?? 4 }, () => (
          <div class="flex flex-col gap-1.5">
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-11 w-full opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Row of label + value used where a setting is shown rather than edited. */
export function ReadOnlyRow(props: {
  label: string;
  children: JSX.Element;
  hint?: string;
}) {
  return (
    <div class="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span class="text-sm font-medium text-text sm:w-40 sm:shrink-0">
        {props.label}
      </span>
      <div class="min-w-0 flex-1 text-base text-text-muted">
        {props.children}
        <Show when={props.hint}>
          <span class="mt-0.5 block text-sm">{props.hint}</span>
        </Show>
      </div>
    </div>
  );
}

/** "View public page" style link, used in section headers. */
export function SectionLink(props: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const inner = (
    <>
      {props.label}
      <Show
        when={props.external}
        fallback={<IconChevronRight aria-hidden="true" class="size-4" />}
      >
        <IconExternalLink aria-hidden="true" class="size-4" />
        <span class="sr-only"> (opens in a new tab)</span>
      </Show>
    </>
  );
  const cls = cn(
    "-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:underline underline-offset-4",
    focusRing,
  );
  return (
    <Show
      when={props.external}
      fallback={
        <A href={props.href} class={cls}>
          {inner}
        </A>
      }
    >
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        class={cls}
      >
        {inner}
      </a>
    </Show>
  );
}
