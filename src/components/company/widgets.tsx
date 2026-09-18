import {
  IconArrowRight,
  IconBox,
  IconCalendarEvent,
  IconCircleCheck,
  IconEdit,
  IconMail,
  IconMapPin,
  IconMovie,
  IconPhone,
  IconSparkles,
  IconStar,
  IconTrash,
  IconUsers,
  IconWorld,
} from "@tabler/icons-solidjs";
import type { Component, JSX } from "solid-js";
import { children, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { focusRing } from "~/components/auth/AuthShell";
import type {
  CompanyContact,
  CompanyProfile,
  CompanyProject,
  CompanyService,
} from "~/components/company/data";
import { Skeleton } from "~/components/dashboard/ui";
import { RatingPill } from "~/components/landing/brand";
import { cn } from "~/lib/cn";

/** Every section of the profile sits on the same card. */
export const sectionClass = "rounded-lg border border-border bg-surface p-5";

const iconMap: Record<string, Component<{ class?: string }>> = {
  location: IconMapPin,
  globe: IconWorld,
  users: IconUsers,
  calendar: IconCalendarEvent,
  mail: IconMail,
  star: IconStar,
  "arrow-right": IconArrowRight,
  film: IconMovie,
  sparkles: IconSparkles,
  box: IconBox,
  check: IconCircleCheck,
};

/**
 * Service icons arrive from the database as free-form strings, so a name the
 * map doesn't know falls back to the generic one rather than rendering nothing.
 */
export function ServiceIcon(props: { name: string; class?: string }) {
  return (
    <Dynamic
      component={iconMap[props.name] ?? IconBox}
      aria-hidden="true"
      class={props.class}
    />
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

export function SectionHeading(props: {
  title: string;
  id: string;
  lead?: string;
  /** Owner-only "Add …" button, rendered at the end of the heading row. */
  action?: JSX.Element;
}) {
  // A slot is read twice — once to test it, once to render it — and a JSX prop
  // is rebuilt on every read. `children` resolves it once, so the test and the
  // render are the same nodes rather than two copies that break hydration.
  const action = children(() => props.action);

  return (
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id={props.id} class="font-display text-lg font-semibold text-text">
          {props.title}
        </h2>
        <Show when={props.lead}>
          <p class="mt-1 max-w-[60ch] text-sm text-pretty text-text-muted">
            {props.lead}
          </p>
        </Show>
      </div>
      <Show when={action()}>{action()}</Show>
    </div>
  );
}

const iconButtonClass = cn(
  "grid size-9 place-items-center rounded-sm text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text disabled:cursor-progress disabled:opacity-60",
  focusRing,
);

/** Edit / remove pair shown on each row while the owner is signed in. */
export function RowActions(props: {
  /** e.g. "Logo design" — completes both buttons' accessible names. */
  label: string;
  busy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  class?: string;
}) {
  return (
    <div class={cn("flex shrink-0 items-center gap-0.5", props.class)}>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onEdit()}
        class={iconButtonClass}
      >
        <IconEdit aria-hidden="true" class="size-4" />
        <span class="sr-only">Edit {props.label}</span>
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onDelete()}
        class={cn(iconButtonClass, "hover:bg-error/10 hover:text-error")}
      >
        <IconTrash aria-hidden="true" class="size-4" />
        <span class="sr-only">Remove {props.label}</span>
      </button>
    </div>
  );
}

function Initial(props: { name: string; class?: string }) {
  return (
    <span
      aria-hidden="true"
      class={cn(
        "grid shrink-0 place-items-center rounded-md bg-primary-soft font-display font-semibold text-primary",
        props.class,
      )}
    >
      {props.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

export function ProfileHero(props: {
  profile: CompanyProfile;
  /** Actions differ for the owner (edit) and a visitor (book, review). */
  actions: JSX.Element;
  /** Owner-only banner explaining that this page is what partners see. */
  notice?: JSX.Element;
}) {
  const p = () => props.profile;
  const rated = () => (p().reviewCount ?? 0) > 0 || (p().rating ?? 0) > 0;
  // Resolved once — see the note in `SectionHeading`.
  const notice = children(() => props.notice);

  return (
    <section aria-labelledby="company-name" class={cn(sectionClass, "sm:p-6")}>
      <Show when={notice()}>
        <div class="mb-5">{notice()}</div>
      </Show>

      <div class="flex flex-col gap-5 md:flex-row md:items-start">
        <Show
          when={p().logo}
          fallback={<Initial name={p().name} class="size-20 text-3xl" />}
        >
          {(logo) => (
            <img
              src={logo()}
              alt=""
              width="80"
              height="80"
              decoding="async"
              class="size-20 shrink-0 rounded-md border border-border object-cover"
            />
          )}
        </Show>

        <div class="min-w-0 flex-1">
          <h1
            id="company-name"
            class="font-display text-xl font-semibold text-balance text-text md:text-2xl"
          >
            {p().name}
          </h1>

          <Show when={p().username}>
            {(username) => (
              <p class="mt-0.5 font-mono text-sm text-text-muted">
                /company/{username()}
              </p>
            )}
          </Show>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <Show when={p().sector}>
              {(sector) => (
                <span class="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                  {sector()}
                </span>
              )}
            </Show>
            <Show
              when={rated()}
              fallback={
                <span class="text-sm text-text-muted">No reviews yet</span>
              }
            >
              <RatingPill
                rating={p().rating ?? 0}
                count={p().reviewCount ?? 0}
                class="py-0.5 text-xs"
              />
            </Show>
          </div>

          <p
            class={cn(
              "mt-3 max-w-[68ch] text-base text-pretty",
              p().description ? "text-text-muted" : "text-text-muted/80 italic",
            )}
          >
            {p().description ??
              "No description yet — a short blurb tells partners what you do."}
          </p>

          <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-muted">
            <Show when={p().address}>
              {(address) => (
                <li class="inline-flex items-center gap-1.5">
                  <IconMapPin aria-hidden="true" class="size-4 shrink-0" />
                  {address()}
                </li>
              )}
            </Show>
            <Show when={p().phone}>
              {(phone) => (
                <li class="inline-flex items-center gap-1.5">
                  <IconPhone aria-hidden="true" class="size-4 shrink-0" />
                  <a
                    href={`tel:${phone()}`}
                    class={cn(
                      "rounded-sm underline-offset-4 hover:underline",
                      focusRing,
                    )}
                  >
                    {phone()}
                  </a>
                </li>
              )}
            </Show>
          </ul>
        </div>

        <div class="flex flex-col gap-2 md:w-56 md:shrink-0">
          {props.actions}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────

function StatTile(props: { label: string; value: string; hint?: string }) {
  return (
    <div class={cn(sectionClass, "p-4")}>
      <p class="font-mono text-2xl font-semibold tabular-nums text-text">
        {props.value}
      </p>
      <p class="mt-0.5 text-sm text-text-muted">{props.label}</p>
      <Show when={props.hint}>
        <p class="mt-0.5 text-xs text-text-muted">{props.hint}</p>
      </Show>
    </div>
  );
}

export function StatRow(props: {
  profile: CompanyProfile;
  services: number;
  projects: number;
}) {
  const rating = () => props.profile.rating ?? 0;

  return (
    <section
      aria-label="Profile at a glance"
      class="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <StatTile
        label="Average rating"
        value={rating() > 0 ? rating().toFixed(1) : "—"}
        hint={rating() > 0 ? "out of 5" : "No rating yet"}
      />
      <StatTile
        label="Reviews collected"
        value={String(props.profile.reviewCount ?? 0)}
      />
      <StatTile label="Services listed" value={String(props.services)} />
      <StatTile label="Work shown" value={String(props.projects)} />
    </section>
  );
}

// ─── Services ────────────────────────────────────────────────────────────

export function ServiceTile(props: {
  service: CompanyService;
  actions?: JSX.Element;
}) {
  // Resolved once — see the note in `SectionHeading`.
  const actions = children(() => props.actions);

  return (
    <li class="flex gap-3 rounded-md border border-border p-4">
      <span class="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
        <ServiceIcon name={props.service.icon} class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="font-display text-base font-semibold text-text">
          {props.service.title}
        </h3>
        <p class="mt-1 text-sm text-pretty text-text-muted">
          {props.service.description}
        </p>
      </div>
      <Show when={actions()}>{actions()}</Show>
    </li>
  );
}

// ─── Work ────────────────────────────────────────────────────────────────

export function ProjectTile(props: {
  project: CompanyProject;
  actions?: JSX.Element;
}) {
  // Resolved once — see the note in `SectionHeading`.
  const actions = children(() => props.actions);

  return (
    <li class="group relative overflow-hidden rounded-md border border-border">
      <img
        src={props.project.imageUrl}
        alt={props.project.altText}
        loading="lazy"
        decoding="async"
        class="aspect-[4/3] w-full bg-background object-cover"
      />
      <Show when={props.project.altText}>
        <p class="border-t border-border px-3 py-2 text-sm text-text-muted">
          {props.project.altText}
        </p>
      </Show>
      <Show when={actions()}>
        <div class="absolute top-2 right-2 rounded-md border border-border bg-surface/95 p-0.5 shadow-sm backdrop-blur">
          {actions()}
        </div>
      </Show>
    </li>
  );
}

// ─── Contacts ────────────────────────────────────────────────────────────

export function ContactRow(props: {
  contact: CompanyContact;
  actions?: JSX.Element;
}) {
  const c = () => props.contact;
  // Resolved once — see the note in `SectionHeading`.
  const actions = children(() => props.actions);

  return (
    <li class="flex items-center gap-3 rounded-md border border-border p-3">
      <Show
        when={c().avatarUrl}
        fallback={<Initial name={c().name} class="size-10 text-base" />}
      >
        {(avatar) => (
          <img
            src={avatar()}
            alt=""
            width="40"
            height="40"
            loading="lazy"
            decoding="async"
            class="size-10 shrink-0 rounded-md border border-border object-cover"
          />
        )}
      </Show>

      <div class="min-w-0 flex-1">
        <p class="truncate font-display text-base font-semibold text-text">
          {c().name}
        </p>
        <p class="truncate text-sm text-text-muted">{c().role}</p>
      </div>

      <Show when={c().email}>
        {(email) => (
          <a
            href={`mailto:${email()}`}
            class={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-sm text-sm text-primary underline-offset-4 hover:underline sm:inline-flex",
              focusRing,
            )}
          >
            <IconMail aria-hidden="true" class="size-4" />
            {email()}
          </a>
        )}
      </Show>

      <Show when={actions()}>{actions()}</Show>
    </li>
  );
}

// ─── Empty and loading ───────────────────────────────────────────────────

/** Sections keep their card while empty, so the page doesn't collapse. */
export function SectionEmpty(props: { children: JSX.Element }) {
  return (
    <p class="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
      {props.children}
    </p>
  );
}

export function ProfileSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-4">
      <span class="sr-only">Loading profile…</span>
      <div class={cn(sectionClass, "sm:p-6")}>
        <div class="flex flex-col gap-5 md:flex-row">
          <Skeleton class="size-20 shrink-0 rounded-md" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton class="h-7 w-1/2" />
            <Skeleton class="h-4 w-1/3 opacity-70" />
            <Skeleton class="mt-2 h-4 w-full opacity-70" />
            <Skeleton class="h-4 w-4/5 opacity-70" />
          </div>
          <div class="flex flex-col gap-2 md:w-56">
            <Skeleton class="h-11 w-full rounded-md" />
            <Skeleton class="h-11 w-full rounded-md opacity-70" />
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <For each={[0, 1, 2, 3]}>
          {() => <Skeleton class="h-[86px] w-full rounded-lg" />}
        </For>
      </div>
      <Skeleton class="h-56 w-full rounded-lg" />
    </div>
  );
}
