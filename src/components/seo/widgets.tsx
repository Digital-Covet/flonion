import { A } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleMinus,
  IconMessageCircle,
  IconSquare,
  IconSquareCheck,
  IconTags,
} from "@tabler/icons-solidjs";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";
import { focusRing } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { RatingPill } from "~/components/landing/brand";
import { btnSecondary } from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import type {
  Category,
  Impact,
  KeywordRow,
  ListingRow,
  MatchStatus,
  ReviewSignals,
  SeoAction,
} from "~/components/seo/data";
import { scoreTier } from "~/components/seo/data";
import { cn } from "~/lib/cn";

// ─── Score ───────────────────────────────────────────────────────────────

export function ScoreCard(props: { score: number; categories: Category[] }) {
  return (
    <div class="flex flex-1 flex-col gap-6">
      <div class="flex flex-col items-center">
        {/* Half-circle gauge: arc length 100 via pathLength. */}
        <svg viewBox="0 0 120 68" class="w-52" aria-hidden="true">
          <path
            d="M10 60a50 50 0 0 1 100 0"
            fill="none"
            stroke="var(--primary-soft)"
            stroke-width="10"
            stroke-linecap="round"
            pathLength="100"
          />
          <path
            d="M10 60a50 50 0 0 1 100 0"
            fill="none"
            stroke="var(--primary)"
            stroke-width="10"
            stroke-linecap="round"
            pathLength="100"
            stroke-dasharray={`${props.score} 100`}
            class="transition-[stroke-dasharray] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          />
        </svg>
        <p class="-mt-9 flex items-baseline gap-1">
          <span class="font-mono text-3xl font-medium text-text tabular-nums">
            {props.score}
          </span>
          <span class="text-sm text-text-muted">out of 100</span>
        </p>
        <p class="mt-1 text-sm font-medium text-text">
          {scoreTier(props.score)}
        </p>
      </div>

      <ul class="flex flex-col gap-4" aria-label="Score by category">
        <For each={props.categories}>
          {(c) => (
            <li class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-sm font-medium text-text">{c.label}</span>
                <Show
                  when={c.score !== null}
                  fallback={
                    <span class="text-xs text-text-muted">Not scored</span>
                  }
                >
                  <span class="font-mono text-sm text-text tabular-nums">
                    {c.score}
                    <span class="sr-only"> out of 100</span>
                  </span>
                </Show>
              </div>
              <div
                aria-hidden="true"
                class="h-2 overflow-hidden rounded-full bg-primary-soft"
              >
                <div
                  class="h-full origin-left rounded-full bg-primary transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
                  style={{ transform: `scaleX(${(c.score ?? 0) / 100})` }}
                />
              </div>
              <span class="text-xs text-text-muted">{c.detail}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

export function ScoreSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col items-center gap-6">
      <span class="sr-only">Loading your local SEO score…</span>
      <Skeleton class="h-28 w-52 rounded-t-full" />
      <div class="flex w-full flex-col gap-5">
        {Array.from({ length: 5 }, () => (
          <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-2/5" />
            <Skeleton class="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Actions ─────────────────────────────────────────────────────────────

const IMPACT_LABEL: Record<Impact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

function ImpactChip(props: { impact: Impact }) {
  return (
    <span
      class={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        props.impact === "high" && "bg-primary-soft text-primary",
        props.impact !== "high" && "border border-border text-text-muted",
      )}
    >
      {IMPACT_LABEL[props.impact]}
    </span>
  );
}

function ActionItem(props: {
  action: SeoAction;
  onToggle: (id: string, done: boolean) => void;
}) {
  const a = () => props.action;
  const titleId = () => `seo-action-${a().id.replace(/[^\w-]/g, "-")}`;

  return (
    <li class="flex gap-3 py-3">
      <Switch>
        <Match when={a().manual}>
          <label class="-m-2.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-md text-primary hover:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
            <input
              type="checkbox"
              class="sr-only"
              checked={a().done}
              aria-labelledby={titleId()}
              onChange={(e) => props.onToggle(a().id, e.currentTarget.checked)}
            />
            <Show
              when={a().done}
              fallback={
                <IconSquare
                  aria-hidden="true"
                  class="size-5 text-border-strong"
                />
              }
            >
              <IconSquareCheck aria-hidden="true" class="size-5" />
            </Show>
          </label>
        </Match>
        <Match when={a().done}>
          <IconCircleCheck
            aria-hidden="true"
            class="mt-px size-6 shrink-0 text-success"
          />
        </Match>
        <Match when={true}>
          <IconCircleDashed
            aria-hidden="true"
            class="mt-px size-6 shrink-0 text-text-muted"
          />
        </Match>
      </Switch>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p
            id={titleId()}
            class={cn(
              "text-base font-medium text-text",
              a().done && "text-text-muted",
            )}
          >
            {a().title}
            <Show when={a().done && !a().manual}>
              <span class="sr-only"> (done)</span>
            </Show>
          </p>
          <Show when={!a().done}>
            <ImpactChip impact={a().impact} />
          </Show>
        </div>
        <Show when={!a().done}>
          <p class="text-sm text-pretty text-text-muted">{a().why}</p>
        </Show>
        <Show when={!a().done && a().link}>
          {(link) => (
            <Show
              when={link().external}
              fallback={
                <A
                  href={link().href}
                  class={cn(
                    "-ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline",
                    focusRing,
                  )}
                >
                  {link().label}
                  <IconChevronRight aria-hidden="true" class="size-4" />
                </A>
              }
            >
              <a
                href={link().href}
                target="_blank"
                rel="noopener noreferrer"
                class={cn(
                  "-ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline",
                  focusRing,
                )}
              >
                {link().label}
                <IconArrowUpRight aria-hidden="true" class="size-4" />
                <span class="sr-only"> (opens in a new tab)</span>
              </a>
            </Show>
          )}
        </Show>
      </div>
    </li>
  );
}

export function ActionList(props: {
  actions: SeoAction[];
  onToggle: (id: string, done: boolean) => void;
}) {
  const [showDone, setShowDone] = createSignal(false);
  const open = () => props.actions.filter((a) => !a.done);
  const done = () => props.actions.filter((a) => a.done);

  return (
    <div class="flex flex-col">
      <Show
        when={open().length}
        fallback={
          <EmptyState
            icon={IconCircleCheck}
            title="Nothing left to fix"
            class="py-8"
          >
            Keep collecting reviews and replying to them to hold your place in
            local results.
          </EmptyState>
        }
      >
        <ul class="-my-3 divide-y divide-border">
          <For each={open()}>
            {(action) => (
              <ActionItem action={action} onToggle={props.onToggle} />
            )}
          </For>
        </ul>
      </Show>

      <Show when={done().length}>
        <div class="mt-4 border-t border-border pt-2">
          <button
            type="button"
            aria-expanded={showDone()}
            aria-controls="seo-done-list"
            onClick={() => setShowDone(!showDone())}
            class={cn(
              "-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 text-sm font-medium text-text-muted hover:bg-primary-soft/60",
              focusRing,
            )}
          >
            <span>
              Done <span class="font-mono tabular-nums">({done().length})</span>
            </span>
            <IconChevronDown
              aria-hidden="true"
              class={cn(
                "size-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none",
                showDone() && "rotate-180",
              )}
            />
          </button>
          <Show when={showDone()}>
            <ul id="seo-done-list" class="divide-y divide-border">
              <For each={done()}>
                {(action) => (
                  <ActionItem action={action} onToggle={props.onToggle} />
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ─── Review signals ──────────────────────────────────────────────────────

function SignalTile(props: {
  label: string;
  children: JSX.Element;
  foot: JSX.Element;
}) {
  return (
    <div class="flex min-h-[112px] flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <p class="text-sm font-medium text-text-muted">{props.label}</p>
      <div class="flex flex-col gap-1 animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none">
        {props.children}
        <p class="text-xs text-text-muted">{props.foot}</p>
      </div>
    </div>
  );
}

const bigNumber = "font-mono text-2xl font-medium text-text tabular-nums";

export function SignalsStrip(props: { signals: ReviewSignals }) {
  const s = () => props.signals;
  const replyDays = () => {
    const d = s().medianReplyDays;
    if (d === null) return "—";
    if (d < 1) return "<1";
    return String(Math.round(d));
  };

  return (
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <SignalTile
        label="Google rating"
        foot={
          s().totalReviewCount >= 100
            ? "Plenty of reviews to build trust"
            : "Aim for a steady stream, not a burst"
        }
      >
        <Show
          when={s().totalReviewCount > 0}
          fallback={<span class={bigNumber}>—</span>}
        >
          <RatingPill
            rating={s().averageRating}
            count={s().totalReviewCount}
            class="self-start"
          />
        </Show>
      </SignalTile>

      <SignalTile label="New in 30 days" foot="Recent reviews rank higher">
        <span class={bigNumber}>{s().last30Days}</span>
      </SignalTile>

      <SignalTile
        label="Reply rate"
        foot={
          <>
            <span class="font-mono tabular-nums">{s().replied}</span> of{" "}
            <span class="font-mono tabular-nums">{s().loaded}</span> latest
            reviews
          </>
        }
      >
        <span class={bigNumber}>{s().loaded ? `${s().replyRate}%` : "—"}</span>
      </SignalTile>

      <SignalTile label="Typical reply time" foot="Within a day is the goal">
        <span class="flex items-baseline gap-1">
          <span class={bigNumber}>{replyDays()}</span>
          <Show when={s().medianReplyDays !== null}>
            <span class="text-sm text-text-muted">
              {replyDays() === "1" ? "day" : "days"}
            </span>
          </Show>
        </span>
      </SignalTile>
    </div>
  );
}

export function SignalsSkeleton() {
  return (
    <div
      aria-busy="true"
      class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <span class="sr-only">Loading review signals…</span>
      {Array.from({ length: 4 }, () => (
        <div class="flex min-h-[112px] flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-7 w-16" />
          <Skeleton class="h-3 w-28 opacity-70" />
        </div>
      ))}
    </div>
  );
}

// ─── Keywords ────────────────────────────────────────────────────────────

function YesNo(props: { yes: boolean; yesLabel: string; noLabel: string }) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1.5 text-sm",
        props.yes ? "text-text" : "text-text-muted",
      )}
    >
      <Show
        when={props.yes}
        fallback={
          <IconCircleMinus
            aria-hidden="true"
            class="size-4 shrink-0 text-warning"
          />
        }
      >
        <IconCircleCheck
          aria-hidden="true"
          class="size-4 shrink-0 text-success"
        />
      </Show>
      {props.yes ? props.yesLabel : props.noLabel}
    </span>
  );
}

export function KeywordsPanel(props: {
  rows: KeywordRow[];
  phrases: Array<{ phrase: string; reviews: number }>;
  reviewsLoaded: number | null;
}) {
  return (
    <div class="flex flex-col gap-5">
      <Show
        when={props.rows.length}
        fallback={
          <EmptyState
            icon={IconTags}
            title="No keywords yet"
            class="py-8"
            action={
              <A href="/settings" class={btnSecondary}>
                Add keywords
              </A>
            }
          >
            Add the words customers type when they look for a business like
            yours, such as “dental clinic in Andheri”.
          </EmptyState>
        }
      >
        {/* Table on md+; stacked cards on phones so nothing scrolls sideways. */}
        <table class="hidden w-full text-left md:table">
          <thead>
            <tr class="border-b border-border text-sm text-text-muted">
              <th scope="col" class="py-2 pr-4 font-medium">
                Keyword
              </th>
              <th scope="col" class="py-2 pr-4 font-medium">
                Description
              </th>
              <th scope="col" class="py-2 text-right font-medium">
                Review mentions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <For each={props.rows}>
              {(row) => (
                <tr class="h-11">
                  <th
                    scope="row"
                    class="py-2 pr-4 text-sm font-medium text-text"
                  >
                    {row.keyword}
                  </th>
                  <td class="py-2 pr-4">
                    <YesNo
                      yes={row.inDescription}
                      yesLabel="Mentioned"
                      noLabel="Not mentioned"
                    />
                  </td>
                  <td class="py-2 text-right font-mono text-sm text-text tabular-nums">
                    {props.reviewsLoaded === null ? "—" : row.reviewMentions}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <ul class="flex flex-col divide-y divide-border md:hidden">
          <For each={props.rows}>
            {(row) => (
              <li class="flex flex-col gap-1.5 py-3 first:pt-0">
                <p class="text-base font-medium text-text">{row.keyword}</p>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <YesNo
                    yes={row.inDescription}
                    yesLabel="In description"
                    noLabel="Not in description"
                  />
                  <Show when={props.reviewsLoaded !== null}>
                    <span class="text-sm text-text-muted">
                      <span class="font-mono text-text tabular-nums">
                        {row.reviewMentions}
                      </span>{" "}
                      review {row.reviewMentions === 1 ? "mention" : "mentions"}
                    </span>
                  </Show>
                </div>
              </li>
            )}
          </For>
        </ul>

        <Show when={props.reviewsLoaded}>
          {(n) => (
            <p class="text-xs text-text-muted">
              Mentions counted across your latest{" "}
              <span class="font-mono tabular-nums">{n()}</span> Google reviews.
            </p>
          )}
        </Show>
      </Show>

      <Show when={props.phrases.length}>
        <div class="border-t border-border pt-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-text">
            <IconMessageCircle aria-hidden="true" class="size-4 text-primary" />
            Words your customers use
          </h3>
          <p class="mt-1 text-sm text-text-muted">
            Phrases that appear in more than one review. If they describe what
            you offer, add them as keywords.
          </p>
          <ul class="mt-3 flex flex-wrap gap-2">
            <For each={props.phrases}>
              {(p) => (
                <li class="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-sm text-text">
                  {p.phrase}
                  <span class="font-mono text-xs text-text-muted tabular-nums">
                    ×{p.reviews}
                    <span class="sr-only"> reviews</span>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}

// ─── Google listing match ────────────────────────────────────────────────

const STATUS_LABEL: Record<MatchStatus, string> = {
  match: "Matches",
  different: "Different",
  missing: "Missing",
};

function StatusLabel(props: { status: MatchStatus; label?: string }) {
  return (
    <span
      class={cn(
        "inline-flex shrink-0 items-center gap-1 text-sm font-medium",
        props.status === "match" ? "text-success" : "text-warning",
      )}
    >
      <Show
        when={props.status === "match"}
        fallback={<IconAlertTriangle aria-hidden="true" class="size-4" />}
      >
        <IconCircleCheck aria-hidden="true" class="size-4" />
      </Show>
      {props.label ?? STATUS_LABEL[props.status]}
    </span>
  );
}

export function ListingPanel(props: { rows: ListingRow[] }) {
  return (
    <ul class="-my-3 flex flex-col divide-y divide-border">
      <For each={props.rows}>
        {(row) => (
          <li class="flex flex-col gap-2 py-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-text">{row.label}</span>
              <StatusLabel
                status={row.status}
                label={
                  row.id === "verified"
                    ? row.status === "match"
                      ? "Verified"
                      : "Not verified"
                    : undefined
                }
              />
            </div>
            <Show when={row.id !== "verified"}>
              <dl class="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt class="text-text-muted">Flonion</dt>
                <dd class="min-w-0 break-words text-text">
                  {row.flonion || (
                    <span class="text-text-muted italic">Not set</span>
                  )}
                </dd>
                <dt class="text-text-muted">Google</dt>
                <dd class="min-w-0 break-words text-text">
                  {row.google || (
                    <span class="text-text-muted italic">Not set</span>
                  )}
                </dd>
              </dl>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export function ListingSkeleton() {
  return (
    <div aria-busy="true" class="flex flex-col gap-5">
      <span class="sr-only">Loading your Google listing…</span>
      {Array.from({ length: 4 }, () => (
        <div class="flex flex-col gap-2">
          <Skeleton class="h-4 w-1/3" />
          <Skeleton class="h-3.5 w-4/5 opacity-70" />
        </div>
      ))}
    </div>
  );
}
