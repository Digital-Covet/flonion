import { A } from "@solidjs/router";
import {
  IconBrandGoogle,
  IconCalendarEvent,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconClock,
  IconListCheck,
  IconMoodEmpty,
  IconMoodSad,
  IconMoodSmile,
  IconSparkles,
} from "@tabler/icons-solidjs";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import type { BusinessInfo } from "~/components/app/context";
import { focusRing } from "~/components/auth/AuthShell";
import {
  type Analytics,
  type GoogleData,
  type Meeting,
  meetingStart,
  type ProfileCheck,
  relativeTime,
  type Sentiment,
  sameMonth,
  sentimentOf,
  stars,
  type Task,
} from "~/components/dashboard/data";
import { DeltaChip, Skeleton } from "~/components/dashboard/ui";
import { OnionRings, RatingPill } from "~/components/landing/brand";
import { btnSecondary } from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";
import type { GoogleReview } from "~/types/google";

// ─── KPI strip ───────────────────────────────────────────────────────────

function KpiTile(props: {
  label: string;
  loading: boolean;
  children: JSX.Element;
  foot?: JSX.Element;
}) {
  return (
    <div class="flex min-h-[124px] flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <p class="text-sm font-medium text-text-muted">{props.label}</p>
      <Show
        when={!props.loading}
        fallback={
          <div aria-busy="true" class="flex flex-col gap-2">
            <span class="sr-only">Loading {props.label}…</span>
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-4 w-28 opacity-70" />
          </div>
        }
      >
        <div class="flex flex-col gap-2 animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none">
          {props.children}
          <Show when={props.foot}>
            <div class="text-xs text-text-muted">{props.foot}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

const kpiValue = "font-mono text-xl font-medium text-text tabular-nums";

function Empty(props: { children: JSX.Element }) {
  return (
    <p class="font-mono text-xl font-medium text-text-muted" aria-hidden="true">
      —<span class="sr-only">{props.children}</span>
    </p>
  );
}

export function KpiStrip(props: {
  business?: BusinessInfo;
  google?: GoogleData;
  googleFailed: boolean;
  analytics?: Analytics;
  analyticsFailed: boolean;
}) {
  const reviews = () =>
    props.google?.kind === "ready" ? props.google.reviews : undefined;

  const monthCounts = () => {
    const list = reviews();
    if (!list) return undefined;
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let current = 0;
    let previous = 0;
    for (const r of list) {
      const d = new Date(r.createTime);
      if (sameMonth(d, now)) current++;
      else if (sameMonth(d, last)) previous++;
    }
    return { current, previous };
  };

  const replyRate = () => {
    const list = reviews();
    if (!list?.length) return undefined;
    const replied = list.filter((r) => r.reviewReply).length;
    return { pct: Math.round((replied / list.length) * 100), n: list.length };
  };

  const googleLoading = () => !props.google && !props.googleFailed;

  return (
    <div class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <KpiTile
        label="Average rating"
        loading={!props.business || googleLoading()}
        foot={
          <Switch>
            <Match
              when={props.google?.kind === "ready" ? props.google : undefined}
            >
              {(g) => (
                <>
                  <span class="font-mono tabular-nums">
                    {g().totalReviewCount}
                  </span>{" "}
                  reviews · live from Google
                </>
              )}
            </Match>
            <Match when={(props.business?.rating ?? 0) > 0 && props.business}>
              {(b) => (
                <>
                  <span class="font-mono tabular-nums">{b().reviewCount}</span>{" "}
                  reviews · last saved from Google
                </>
              )}
            </Match>
          </Switch>
        }
      >
        <Switch
          fallback={
            <div class="flex flex-col gap-1">
              <Empty>No rating yet</Empty>
              <a
                href="/api/google/auth"
                rel="external"
                class={cn(
                  "inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline",
                  focusRing,
                )}
              >
                <IconBrandGoogle aria-hidden="true" class="size-4" />
                Connect Google to see your rating
              </a>
            </div>
          }
        >
          <Match
            when={
              props.google?.kind === "ready" && props.google.totalReviewCount
                ? props.google
                : undefined
            }
          >
            {(g) => (
              <RatingPill
                rating={g().averageRating}
                class="self-start text-base"
              />
            )}
          </Match>
          <Match when={(props.business?.rating ?? 0) > 0 && props.business}>
            {(b) => (
              <RatingPill rating={b().rating} class="self-start text-base" />
            )}
          </Match>
        </Switch>
      </KpiTile>

      <KpiTile
        label="Reviews this month"
        loading={googleLoading()}
        foot={
          <Show
            when={monthCounts()}
            fallback={
              props.googleFailed ? "Couldn't reach Google" : "Needs Google"
            }
          >
            {(m) => (
              <DeltaChip
                value={m().current - m().previous}
                since="last month"
              />
            )}
          </Show>
        }
      >
        <Show when={monthCounts()} fallback={<Empty>No data</Empty>}>
          {(m) => <p class={kpiValue}>{m().current}</p>}
        </Show>
      </KpiTile>

      <KpiTile
        label="QR scans"
        loading={!props.analytics && !props.analyticsFailed}
        foot={
          <Show when={props.analytics} fallback="Couldn't load scans">
            {(a) => (
              <>
                Across{" "}
                <span class="font-mono tabular-nums">{a().totalLinks}</span>{" "}
                review {a().totalLinks === 1 ? "link" : "links"}
              </>
            )}
          </Show>
        }
      >
        <Show when={props.analytics} fallback={<Empty>No data</Empty>}>
          {(a) => <p class={kpiValue}>{a().totalQrScans.toLocaleString()}</p>}
        </Show>
      </KpiTile>

      <KpiTile
        label="Reply rate"
        loading={googleLoading()}
        foot={
          <Show when={replyRate()} fallback="Needs Google reviews">
            {(r) => (
              <>
                Of your latest{" "}
                <span class="font-mono tabular-nums">{r().n}</span> reviews
              </>
            )}
          </Show>
        }
      >
        <Show when={replyRate()} fallback={<Empty>No data</Empty>}>
          {(r) => <p class={kpiValue}>{r().pct}%</p>}
        </Show>
      </KpiTile>
    </div>
  );
}

// ─── Needs attention ─────────────────────────────────────────────────────

const SENTIMENT: Record<
  Sentiment,
  { label: string; icon: typeof IconMoodSmile; class: string }
> = {
  positive: {
    label: "Positive",
    icon: IconMoodSmile,
    class: "bg-success/10 text-success",
  },
  mixed: {
    label: "Mixed",
    icon: IconMoodEmpty,
    class: "bg-warning/10 text-warning",
  },
  negative: {
    label: "Negative",
    icon: IconMoodSad,
    class: "bg-error/10 text-error",
  },
};

export function SentimentLabel(props: { review: GoogleReview }) {
  const s = () => SENTIMENT[sentimentOf(props.review)];
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        s().class,
      )}
    >
      {(() => {
        const Icon = s().icon;
        return <Icon aria-hidden="true" class="size-3.5" />;
      })()}
      {s().label}
    </span>
  );
}

export function unrepliedReviews(google?: GoogleData): GoogleReview[] {
  if (google?.kind !== "ready") return [];
  return google.reviews
    .filter((r) => !r.reviewReply)
    .sort(
      (a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
    );
}

export function ReviewList(props: { reviews: GoogleReview[] }) {
  return (
    <ul class="-mx-4 divide-y divide-border md:-mx-5">
      <For each={props.reviews}>
        {(review) => (
          <li class="flex flex-col gap-3 px-4 py-4 first:pt-0 sm:flex-row sm:items-start md:px-5">
            <div class="flex min-w-0 flex-1 gap-3">
              <span
                aria-hidden="true"
                class="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary"
              >
                {(review.reviewer.displayName || "A").charAt(0).toUpperCase()}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="font-medium text-text">
                    {review.reviewer.isAnonymous
                      ? "Anonymous"
                      : review.reviewer.displayName || "Google user"}
                  </p>
                  <RatingPill rating={stars(review)} class="py-0.5 text-xs" />
                  <SentimentLabel review={review} />
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-text-muted">
                  {review.comment || <em>Rating only, no written review</em>}
                </p>
                <p class="mt-1 text-xs text-text-muted">
                  <time datetime={review.createTime}>
                    {relativeTime(review.createTime)}
                  </time>{" "}
                  · Google
                </p>
              </div>
            </div>
            <A
              href={`/reviews/inbox?review=${encodeURIComponent(review.reviewId)}`}
              class={cn(
                btnSecondary,
                "shrink-0 self-start px-4 text-sm sm:ml-12",
              )}
            >
              <IconSparkles aria-hidden="true" class="size-4 text-primary" />
              Draft reply
              <span class="sr-only">
                {" "}
                to {review.reviewer.displayName || "this review"}
              </span>
            </A>
          </li>
        )}
      </For>
    </ul>
  );
}

export function AllCaughtUp() {
  return (
    <div class="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
      <span class="relative grid size-24 place-items-center">
        <OnionRings rings={3} class="absolute inset-0 size-24" />
        <IconCircleCheck aria-hidden="true" class="size-8 text-success" />
      </span>
      <p class="font-display text-lg font-semibold text-text">
        You're all caught up
      </p>
      <p class="max-w-[36ch] text-sm text-text-muted">
        Every recent Google review has a reply. New ones will show up here.
      </p>
    </div>
  );
}

export type SetupStep = {
  label: string;
  hint: string;
  href: string;
  external?: boolean;
  done: boolean;
};

export function setupSteps(
  business: BusinessInfo,
  google: GoogleData | undefined,
  analytics: Analytics | undefined,
): SetupStep[] {
  return [
    {
      label: "Connect Google",
      hint: "See your rating and reply to reviews from Flonion.",
      href: "/api/google/auth",
      external: true,
      done: google !== undefined && google.kind !== "disconnected",
    },
    {
      label: "Create your first review request",
      hint: "A link and QR code customers can use in seconds.",
      href: "/reviews/new",
      done: (analytics?.totalLinks ?? 0) > 0,
    },
    {
      label: "Print your QR code",
      hint: "Place it on your counter. Done once it gets its first scan.",
      href: "/reviews/new",
      done: (analytics?.totalQrScans ?? 0) > 0,
    },
    {
      label: "Invite your team",
      hint: "Share the work of replying and follow-ups.",
      href: "/settings/team",
      done: business.teamMembers.length > 1,
    },
  ];
}

export function SetupChecklist(props: { steps: SetupStep[] }) {
  const done = () => props.steps.filter((s) => s.done).length;
  return (
    <div class="flex flex-col gap-4">
      <div>
        <p class="flex items-baseline justify-between text-sm">
          <span class="flex items-center gap-1.5 font-medium text-text">
            <IconListCheck aria-hidden="true" class="size-4 text-primary" />
            Get set up
          </span>
          <span class="text-text-muted">
            <span class="font-mono tabular-nums">{done()}</span> of{" "}
            <span class="font-mono tabular-nums">{props.steps.length}</span>{" "}
            done
          </span>
        </p>
        <div
          aria-hidden="true"
          class="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft"
        >
          <div
            class="h-full origin-left rounded-full bg-primary transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
            style={{ transform: `scaleX(${done() / props.steps.length})` }}
          />
        </div>
      </div>
      <ol class="flex flex-col gap-1">
        <For each={props.steps}>
          {(step) => (
            <li>
              <a
                href={step.href}
                rel={step.external ? "external" : undefined}
                class={cn(
                  "flex min-h-14 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft/60",
                  focusRing,
                )}
              >
                <Show
                  when={step.done}
                  fallback={
                    <IconCircle
                      aria-hidden="true"
                      class="size-5 shrink-0 text-border-strong"
                    />
                  }
                >
                  <IconCircleCheck
                    aria-hidden="true"
                    class="size-5 shrink-0 text-success"
                  />
                </Show>
                <span class="min-w-0 flex-1">
                  <span
                    class={cn(
                      "block font-medium",
                      step.done ? "text-text-muted line-through" : "text-text",
                    )}
                  >
                    <span class="sr-only">
                      {step.done ? "Done: " : "To do: "}
                    </span>
                    {step.label}
                  </span>
                  <span class="block text-sm text-text-muted">{step.hint}</span>
                </span>
                <IconChevronRight
                  aria-hidden="true"
                  class="size-4 shrink-0 text-text-muted"
                />
              </a>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

// ─── Profile score ───────────────────────────────────────────────────────

export function ProfileScore(props: { checks: ProfileCheck[] }) {
  const score = () =>
    props.checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  const todo = () =>
    props.checks
      .filter((c) => !c.done)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
  const tier = () =>
    score() >= 80 ? "Strong" : score() >= 50 ? "Good start" : "Needs work";

  // Half-circle gauge: arc length 100 via pathLength.
  return (
    <div class="flex flex-1 flex-col gap-4">
      <div class="flex flex-col items-center">
        <svg viewBox="0 0 120 68" class="w-44" aria-hidden="true">
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
            stroke-dasharray={`${score()} 100`}
            class="transition-[stroke-dasharray] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          />
        </svg>
        <p class="-mt-8 flex items-baseline gap-1">
          <span class="font-mono text-2xl font-medium text-text tabular-nums">
            {score()}
          </span>
          <span class="text-sm text-text-muted">out of 100</span>
        </p>
        <p class="mt-1 text-sm font-medium text-text">{tier()}</p>
      </div>

      <Show
        when={todo().length}
        fallback={
          <p class="flex items-center gap-2 text-sm text-text-muted">
            <IconCircleCheck aria-hidden="true" class="size-4 text-success" />
            Your profile is complete.
          </p>
        }
      >
        <div>
          <h3 class="mb-1 text-sm font-medium text-text-muted">
            Top improvements
          </h3>
          <ul class="flex flex-col">
            <For each={todo()}>
              {(c) => (
                <li>
                  <A
                    href={c.href}
                    class={cn(
                      "-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-text hover:bg-primary-soft/60",
                      focusRing,
                    )}
                  >
                    <span class="flex-1">{c.action}</span>
                    <span class="font-mono text-xs text-text-muted tabular-nums">
                      +{c.weight}
                    </span>
                    <IconChevronRight
                      aria-hidden="true"
                      class="size-4 text-text-muted"
                    />
                  </A>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}

// ─── Upcoming ────────────────────────────────────────────────────────────

export function upcomingMeetings(meetings: Meeting[], now = new Date()) {
  return meetings
    .filter(
      (m) =>
        (m.status === "pending" || m.status === "accepted") &&
        meetingStart(m).getTime() >= now.getTime(),
    )
    .sort((a, b) => meetingStart(a).getTime() - meetingStart(b).getTime())
    .slice(0, 3);
}

export function dueTasks(tasks: Task[], now = new Date()) {
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  return tasks
    .filter(
      (t) =>
        t.column !== "done" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < endOfToday,
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
    )
    .slice(0, 3);
}

function meetingWith(m: Meeting) {
  if (m.direction === "outgoing") return m.business?.name ?? "Partner";
  return m.requester?.name ?? m.guestName ?? "Guest";
}

export function MeetingList(props: { meetings: Meeting[] }) {
  return (
    <ul class="flex flex-col gap-1">
      <For each={props.meetings}>
        {(m) => {
          const start = meetingStart(m);
          return (
            <li class="flex min-h-14 items-center gap-3">
              <span class="grid w-11 shrink-0 place-items-center rounded-md bg-primary-soft py-1 text-primary">
                <span class="text-[10px] font-semibold uppercase">
                  {start.toLocaleDateString(undefined, { month: "short" })}
                </span>
                <span class="font-mono text-base leading-none font-medium tabular-nums">
                  {start.getDate()}
                </span>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">
                  {m.category === "team" ? "Team meeting" : "Meeting"} with{" "}
                  {meetingWith(m)}
                </p>
                <p class="text-xs text-text-muted">
                  <span class="font-mono tabular-nums">
                    {m.slot.startTime}–{m.slot.endTime}
                  </span>{" "}
                  · {m.status === "accepted" ? "Confirmed" : "Awaiting reply"}
                </p>
              </div>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

export function TaskList(props: { tasks: Task[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <ul class="flex flex-col gap-1">
      <For each={props.tasks}>
        {(t) => {
          const overdue = new Date(t.dueDate ?? 0).getTime() < today.getTime();
          return (
            <li class="flex min-h-12 items-center gap-3">
              <IconCircle
                aria-hidden="true"
                class="size-5 shrink-0 text-border-strong"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">{t.title}</p>
                <p
                  class={cn(
                    "flex items-center gap-1 text-xs",
                    overdue ? "text-error" : "text-text-muted",
                  )}
                >
                  <IconClock aria-hidden="true" class="size-3.5" />
                  {overdue ? "Overdue" : "Due today"}
                  <Show when={t.assignee}>
                    {(a) => <span class="text-text-muted">· {a().name}</span>}
                  </Show>
                </p>
              </div>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

export function UpcomingEmpty(props: { children: JSX.Element }) {
  return (
    <p class="flex min-h-12 items-center gap-2 text-sm text-text-muted">
      <IconCalendarEvent aria-hidden="true" class="size-4" />
      {props.children}
    </p>
  );
}
