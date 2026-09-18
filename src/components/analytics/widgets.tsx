import { A } from "@solidjs/router";
import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
  IconChartBar,
  IconExternalLink,
  IconPlus,
  IconQrcode,
} from "@tabler/icons-solidjs";
import { For, type JSX, Show } from "solid-js";
import type {
  FunnelStage,
  LinkRow,
  PlatformRow,
  SortDir,
  SortKey,
  Totals,
} from "~/components/analytics/data";
import {
  conversionRate,
  linkTitle,
  SORT_COLUMNS,
} from "~/components/analytics/data";
import { focusRing } from "~/components/auth/AuthShell";
import { relativeTime } from "~/components/dashboard/data";
import { Skeleton } from "~/components/dashboard/ui";
import { RatingPill } from "~/components/landing/brand";
import {
  btnPrimary,
  btnSecondary,
  SelectField,
} from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

const num = (n: number) => n.toLocaleString();

// ─── KPI strip ───────────────────────────────────────────────────────────

function Tile(props: {
  label: string;
  value: number;
  foot?: JSX.Element;
  icon?: JSX.Element;
}) {
  return (
    <div class="flex min-h-[124px] flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <p class="flex items-center gap-1.5 text-sm font-medium text-text-muted">
        {props.icon}
        {props.label}
      </p>
      <div class="flex flex-col gap-2 animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none">
        <p class="font-mono text-xl font-medium text-text tabular-nums">
          {num(props.value)}
        </p>
        <Show when={props.foot}>
          <div class="text-xs text-pretty text-text-muted">{props.foot}</div>
        </Show>
      </div>
    </div>
  );
}

export function KpiStrip(props: {
  totals: Totals;
  /** Scans counted on the business QR sheet rather than on one link. */
  unattributedScans: number;
}) {
  const rate = () => conversionRate(props.totals);
  return (
    <div class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <Tile
        label="Links created"
        value={props.totals.links}
        foot={
          <>
            <span class="font-mono tabular-nums">
              {num(props.totals.qrScans + props.unattributedScans)}
            </span>{" "}
            QR scans
            <Show when={props.unattributedScans > 0}>
              {" "}
              (
              <span class="font-mono tabular-nums">
                {num(props.unattributedScans)}
              </span>{" "}
              from your printed sheet)
            </Show>
          </>
        }
      />
      <Tile
        label="Page visits"
        value={props.totals.visits}
        foot="Times a customer opened a review page."
      />
      <Tile
        label="Reviews written"
        value={props.totals.reviews}
        foot={
          <>
            <span class="font-mono tabular-nums">{rate()}%</span> of visits
            ended in a review.
          </>
        }
      />
      <Tile
        label="Sent to a platform"
        value={props.totals.redirects}
        foot={
          <>
            <span class="font-mono tabular-nums">
              {num(props.totals.aiCopies)}
            </span>{" "}
            AI drafts used along the way.
          </>
        }
      />
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div
      aria-busy="true"
      class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"
    >
      <span class="sr-only">Loading totals…</span>
      <For each={[0, 1, 2, 3]}>
        {() => (
          <div class="flex min-h-[124px] flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-3.5 w-28 opacity-70" />
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Funnel ──────────────────────────────────────────────────────────────

/**
 * Horizontal bars, widest stage first. Every bar states its own number and
 * share as text, so the chart is readable without seeing the bar at all.
 */
export function Funnel(props: { stages: FunnelStage[] }) {
  return (
    <ol class="flex flex-col gap-4">
      <For each={props.stages}>
        {(stage, i) => (
          <li class="flex flex-col gap-2">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p class="flex items-baseline gap-2 text-sm font-medium text-text">
                <span class="font-mono text-xs text-text-muted tabular-nums">
                  {i() + 1}
                </span>
                {stage.label}
              </p>
              <p class="text-sm text-text-muted">
                <span class="font-mono text-base font-medium text-text tabular-nums">
                  {num(stage.value)}
                </span>
                <Show when={stage.ofPrev !== null}>
                  {" · "}
                  <span class="font-mono tabular-nums">{stage.ofPrev}%</span> of
                  the step above
                </Show>
              </p>
            </div>
            <div
              aria-hidden="true"
              class="h-3 w-full overflow-hidden rounded-full bg-primary-soft"
            >
              <div
                class="h-full rounded-full bg-primary transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none"
                style={{
                  width: `${Math.max(stage.value > 0 ? 2 : 0, stage.ofFirst)}%`,
                }}
              />
            </div>
            <p class="text-xs text-pretty text-text-muted">
              {stage.hint}
              <Show when={(stage.dropOff ?? 0) > 0}>
                {" "}
                <span class="font-mono tabular-nums">
                  {num(stage.dropOff ?? 0)}
                </span>{" "}
                stopped here.
              </Show>
            </p>
          </li>
        )}
      </For>
    </ol>
  );
}

export function FunnelSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-5">
      <span class="sr-only">Loading the funnel…</span>
      <For each={[0, 1, 2]}>
        {() => (
          <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-1/3" />
            <Skeleton class="h-3 w-full rounded-full" />
            <Skeleton class="h-3.5 w-2/3 opacity-70" />
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Platforms ───────────────────────────────────────────────────────────

export function PlatformPanel(props: { rows: PlatformRow[] }) {
  return (
    <ul class="flex flex-col gap-3">
      <For each={props.rows}>
        {(row) => (
          <li class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-4">
              <p class="text-sm font-medium text-text">{row.label}</p>
              <p class="text-sm text-text-muted">
                <span class="font-mono text-text tabular-nums">
                  {num(row.count)}
                </span>{" "}
                · <span class="font-mono tabular-nums">{row.share}%</span>
              </p>
            </div>
            <div
              aria-hidden="true"
              class="h-2 w-full overflow-hidden rounded-full bg-primary-soft"
            >
              <div
                class="h-full rounded-full bg-secondary"
                style={{
                  width: `${Math.max(row.count > 0 ? 2 : 0, row.share)}%`,
                }}
              />
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}

export function NoPlatformRedirects() {
  return (
    <div class="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
      <IconExternalLink aria-hidden="true" class="size-8 text-text-muted" />
      <p class="max-w-[40ch] text-sm text-pretty text-text-muted">
        Nobody has tapped through to a review platform yet. The platforms you
        link in Settings appear here once customers start using them.
      </p>
      <A href="/settings" class={cn(btnSecondary, "min-h-9 px-3 text-sm")}>
        Check your platform links
      </A>
    </div>
  );
}

// ─── Per-link table ──────────────────────────────────────────────────────

const SORT_CHOICES = [
  { value: "created:desc", label: "Newest first" },
  { value: "created:asc", label: "Oldest first" },
  { value: "visits:desc", label: "Most visits" },
  { value: "reviews:desc", label: "Most reviews" },
  { value: "redirects:desc", label: "Most redirects" },
  { value: "rate:desc", label: "Best conversion" },
  { value: "rate:asc", label: "Worst conversion" },
] as const;

/** Phone-sized control for the same sort the table headers apply on desktop. */
export function SortSelect(props: {
  sort: SortKey;
  dir: SortDir;
  onChange: (sort: SortKey, dir: SortDir) => void;
  class?: string;
}) {
  const current = () => {
    const key = `${props.sort}:${props.dir}`;
    return SORT_CHOICES.some((c) => c.value === key) ? key : "created:desc";
  };
  return (
    <SelectField
      label="Sort links"
      options={SORT_CHOICES}
      value={current()}
      class={props.class}
      onChange={(v) => {
        const [sort, dir] = (v || "created:desc").split(":");
        props.onChange(sort as SortKey, dir as SortDir);
      }}
    />
  );
}

function SortHeader(props: {
  column: (typeof SORT_COLUMNS)[number];
  sort: SortKey;
  dir: SortDir;
  onSort: (sort: SortKey, dir: SortDir) => void;
}) {
  const active = () => props.sort === props.column.key;
  const next = () =>
    active() ? (props.dir === "asc" ? "desc" : "asc") : props.column.defaultDir;
  return (
    <th
      scope="col"
      aria-sort={
        active() ? (props.dir === "asc" ? "ascending" : "descending") : "none"
      }
      class="py-2 text-right font-medium"
    >
      <button
        type="button"
        onClick={() => props.onSort(props.column.key, next())}
        class={cn(
          "-mr-2 inline-flex min-h-9 items-center gap-1 rounded-sm px-2 hover:text-text",
          active() ? "text-text" : "text-text-muted",
          focusRing,
        )}
      >
        {props.column.label}
        <Show
          when={active()}
          fallback={
            <IconArrowsSort aria-hidden="true" class="size-3.5 opacity-60" />
          }
        >
          <Show
            when={props.dir === "asc"}
            fallback={<IconArrowDown aria-hidden="true" class="size-3.5" />}
          >
            <IconArrowUp aria-hidden="true" class="size-3.5" />
          </Show>
        </Show>
        <span class="sr-only">
          {active()
            ? props.dir === "asc"
              ? ", sorted lowest first"
              : ", sorted highest first"
            : ", not sorted"}
        </span>
      </button>
    </th>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <span class="text-sm text-text-muted">
      <span class="font-mono text-text tabular-nums">{props.value}</span>{" "}
      {props.label}
    </span>
  );
}

export function LinksTable(props: {
  rows: LinkRow[];
  sort: SortKey;
  dir: SortDir;
  onSort: (sort: SortKey, dir: SortDir) => void;
}) {
  return (
    <>
      {/* Table on md+; stacked cards on phones so nothing scrolls sideways. */}
      <table class="hidden w-full text-left md:table">
        <caption class="sr-only">
          Review links with their visits, reviews and redirects
        </caption>
        <thead>
          <tr class="border-b border-border text-sm text-text-muted">
            <th scope="col" class="py-2 pr-4 font-medium">
              Link
            </th>
            <For each={SORT_COLUMNS}>
              {(column) => (
                <SortHeader
                  column={column}
                  sort={props.sort}
                  dir={props.dir}
                  onSort={props.onSort}
                />
              )}
            </For>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <For each={props.rows}>
            {(row) => (
              <tr class="h-11">
                <th scope="row" class="max-w-[28ch] py-2 pr-4 font-normal">
                  <span class="block truncate text-sm font-medium text-text">
                    {linkTitle(row)}
                  </span>
                  <span class="block text-xs text-text-muted">
                    Suggested {row.rating} of 5
                  </span>
                </th>
                <td class="py-2 text-right text-sm text-text-muted">
                  <time datetime={row.createdAt}>
                    {relativeTime(row.createdAt)}
                  </time>
                </td>
                <td class="py-2 text-right font-mono text-sm text-text tabular-nums">
                  {num(row.visits)}
                </td>
                <td class="py-2 text-right font-mono text-sm text-text tabular-nums">
                  {num(row.reviews)}
                </td>
                <td class="py-2 text-right font-mono text-sm text-text tabular-nums">
                  {num(row.redirects)}
                </td>
                <td class="py-2 text-right font-mono text-sm text-text tabular-nums">
                  {conversionRate(row)}%
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <ul class="flex flex-col divide-y divide-border md:hidden">
        <For each={props.rows}>
          {(row) => (
            <li class="flex flex-col gap-2 py-3 first:pt-0">
              <div class="flex items-start justify-between gap-3">
                <p class="min-w-0 flex-1 text-base font-medium text-pretty text-text">
                  {linkTitle(row)}
                </p>
                <RatingPill rating={row.rating} class="shrink-0" />
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Stat label="visits" value={num(row.visits)} />
                <Stat label="reviews" value={num(row.reviews)} />
                <Stat label="redirects" value={num(row.redirects)} />
                <Stat label="converted" value={`${conversionRate(row)}%`} />
              </div>
              <p class="text-xs text-text-muted">
                Created{" "}
                <time datetime={row.createdAt}>
                  {relativeTime(row.createdAt)}
                </time>
              </p>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}

export function TableSkeleton(props: { rows: number }) {
  return (
    <div aria-busy="true" class="flex flex-col gap-4">
      <span class="sr-only">Loading your links…</span>
      <For each={Array.from({ length: props.rows })}>
        {() => (
          <div class="flex items-center gap-3">
            <div class="flex flex-1 flex-col gap-2">
              <Skeleton class="h-4 w-2/5" />
              <Skeleton class="h-3.5 w-1/4 opacity-70" />
            </div>
            <Skeleton class="h-4 w-10" />
            <Skeleton class="h-4 w-10" />
            <Skeleton class="h-4 w-10" />
          </div>
        )}
      </For>
    </div>
  );
}

export function NoLinksYet() {
  return (
    <EmptyState
      icon={IconQrcode}
      title="No review requests yet"
      action={
        <A href="/reviews/new" class={btnPrimary}>
          <IconPlus aria-hidden="true" class="size-5" />
          Create review request
        </A>
      }
    >
      Every link and QR code you create is measured here: how many customers
      opened it, wrote a review, and went on to post it.
    </EmptyState>
  );
}

export function NoLinksInRange(props: { range: string; onClear: () => void }) {
  return (
    <EmptyState icon={IconChartBar} title="No links in this period">
      <>
        No review requests were created in {props.range}.{" "}
        <button
          type="button"
          onClick={() => props.onClear()}
          class={cn(
            "rounded-sm font-medium text-primary underline underline-offset-4",
            focusRing,
          )}
        >
          Show all time
        </button>
        .
      </>
    </EmptyState>
  );
}
