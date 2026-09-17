import { Title } from "@solidjs/meta";
import CalendarDays from "lucide-solid/icons/calendar-days";
import CheckCircle2 from "lucide-solid/icons/check-circle-2";
import Inbox from "lucide-solid/icons/inbox";
import ListChecks from "lucide-solid/icons/list-checks";
import QrCode from "lucide-solid/icons/qr-code";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import Star from "lucide-solid/icons/star";
import Unplug from "lucide-solid/icons/unplug";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  type Resource,
  Show,
} from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { ChartAdapter } from "~/components/charts/ChartAdapter";
import { Badge, SentimentBadge } from "~/components/ui/badge";
import { Button, ButtonLink } from "~/components/ui/button";
import { CardHeader, KpiCard } from "~/components/ui/card";
import {
  SkeletonKpiRow,
  SkeletonRows,
  WidgetError,
} from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import { recentActivity } from "~/features/dashboard/data";
import { seoActionItems } from "~/features/seo/seo-data";
import { googleStarRatingToNumber } from "~/types/google";

interface AnalyticsBreakdown {
  id: string;
  rating: number;
  visits: number;
  reviews: number;
  qrScans: number;
  createdAt: string;
}

interface AnalyticsSummary {
  totalReviews: number;
  totalQrScans: number;
  totalRedirects: number;
  totalLinks: number;
  breakdown: AnalyticsBreakdown[];
}

interface BusinessSummary {
  name: string;
  rating: number;
  reviewCount: number;
}

interface QueueItem {
  id: string;
  name: string;
  rating: number;
  preview: string;
  ago: string;
}

interface TaskItem {
  id: string;
  title: string;
  column: string;
  priority: string | null;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  time: string;
}

async function fetchAnalytics(): Promise<AnalyticsSummary> {
  if (isServer)
    return {
      totalReviews: 0,
      totalQrScans: 0,
      totalRedirects: 0,
      totalLinks: 0,
      breakdown: [],
    };
  const res = await fetch("/api/reviews/analytics");
  if (!res.ok) throw new Error(`Analytics failed (${res.status})`);
  const data = await res.json();
  return {
    totalReviews: data.totalReviews ?? 0,
    totalQrScans: data.totalQrScans ?? 0,
    totalRedirects: data.totalRedirects ?? 0,
    totalLinks: data.totalLinks ?? 0,
    breakdown: Array.isArray(data.reviews) ? data.reviews : [],
  };
}

async function fetchBusiness(): Promise<BusinessSummary> {
  if (isServer) return { name: "", rating: 0, reviewCount: 0 };
  const res = await fetch("/api/business");
  if (!res.ok) throw new Error(`Business failed (${res.status})`);
  const data = await res.json();
  return {
    name: data.businessName ?? "",
    rating: Number(data.rating ?? 0),
    reviewCount: Number(data.reviewCount ?? 0),
  };
}

async function fetchGoogleConnected(): Promise<boolean> {
  if (isServer) return false;
  try {
    const res = await fetch("/api/google/status");
    if (!res.ok) return false;
    return Boolean((await res.json()).connected);
  } catch {
    return false;
  }
}

function agoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (!Number.isFinite(days) || days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

async function fetchNeedsReply(): Promise<QueueItem[]> {
  if (isServer) return [];
  const connected = await fetchGoogleConnected();
  if (!connected) return [];
  const locRes = await fetch("/api/google/locations");
  if (!locRes.ok) throw new Error("Locations failed");
  const locData = await locRes.json();
  const out: QueueItem[] = [];
  for (const account of locData.accounts ?? []) {
    for (const location of account.locations ?? []) {
      if (out.length >= 5) break;
      const accountId = String(account.name).replace("accounts/", "");
      const locationId = String(location.name).replace("locations/", "");
      const res = await fetch(
        `/api/google/reviews?accountId=${accountId}&locationId=${locationId}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.reviews ?? []) {
        if (r.reviewReply || out.length >= 5) continue;
        out.push({
          id: r.reviewId,
          name: r.reviewer?.displayName || "Anonymous",
          rating: googleStarRatingToNumber(r.starRating),
          preview: (r.comment || "(No review text)").slice(0, 120),
          ago: agoLabel(r.updateTime),
        });
      }
    }
    if (out.length >= 5) break;
  }
  return out;
}

async function fetchTodayTasks(): Promise<TaskItem[]> {
  if (isServer) return [];
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Tasks failed (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((t) => t?.column !== "done")
    .slice(0, 3)
    .map((t) => ({
      id: String(t.id ?? crypto.randomUUID()),
      title: String(t.title ?? "Untitled task"),
      column: String(t.column ?? "todo").replace(/_/g, " "),
      priority: t.priority ? String(t.priority) : null,
    }));
}

async function fetchUpcomingMeetings(): Promise<UpcomingMeeting[]> {
  if (isServer) return [];
  const res = await fetch("/api/marketplace/meetings?type=incoming");
  if (!res.ok) return [];
  const data = await res.json();
  return (
    (data.meetings ?? []) as Array<{
      id: string;
      slot?: { date: string; startTime: string; endTime: string } | null;
      requester?: { name: string | null; email: string | null } | null;
      guestName?: string | null;
    }>
  )
    .slice(0, 3)
    .map((m) => ({
      id: m.id,
      title: m.requester?.name || m.guestName || "Guest",
      time: m.slot
        ? `${new Date(m.slot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${m.slot.startTime}`
        : "Unscheduled",
    }));
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// Read a resource without registering with <Suspense>. A suspending read here
// flips the route's Suspense to its fallback while hydrating, which leaves
// Solid's hydration context set; the next lucide icon render then crashes with
// "template is not a function". Each widget renders its own loading state.
function peek<T>(resource: Resource<T>): T | undefined {
  return resource.state === "ready" || resource.state === "refreshing"
    ? resource.latest
    : undefined;
}

function sentimentOf(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

const GOOGLE_NUDGE_KEY = "flonion:google-nudge-dismissed:v1";
const STALE_MS = 5 * 60 * 1000;

export default function DashboardPage() {
  const [analytics, { refetch: refetchAnalytics }] =
    createResource(fetchAnalytics);
  const [business, { refetch: refetchBusiness }] =
    createResource(fetchBusiness);
  const [googleConnected, { refetch: refetchGoogle }] =
    createResource(fetchGoogleConnected);
  const [queue, { refetch: refetchQueue }] = createResource(fetchNeedsReply);
  const [tasks, { refetch: refetchTasks }] = createResource(fetchTodayTasks);
  const [meetings, { refetch: refetchMeetings }] = createResource(
    fetchUpcomingMeetings,
  );
  const [dismissedNudge, setDismissedNudge] = createSignal(false);
  const [tick, setTick] = createSignal(Date.now());
  const [lastFetch, setLastFetch] = createSignal(0);
  const [announcement, setAnnouncement] = createSignal("");

  const refreshAll = (announce = false) => {
    refetchAnalytics();
    refetchBusiness();
    refetchGoogle();
    refetchQueue();
    refetchTasks();
    refetchMeetings();
    const now = Date.now();
    setTick(now);
    setLastFetch(now);
    if (announce) {
      const total = peek(analytics)?.totalReviews ?? 0;
      setAnnouncement(
        `Dashboard refreshed. ${total} reviews collected, ${peek(queue)?.length ?? 0} need a reply.`,
      );
      notify("success", "Dashboard refreshed");
    }
  };

  // No polling (DS §6): refresh on focus only when data is older than 5 min.
  onMount(() => {
    // SSR renders safe defaults; refetch on the client after hydration so
    // the dashboard never sticks on zeros from the server snapshot.
    refreshAll();
    let stored = false;
    try {
      stored = localStorage.getItem(GOOGLE_NUDGE_KEY) === "1";
    } catch {
      stored = false;
    }
    setDismissedNudge(stored);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetch() > STALE_MS) {
        refreshAll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", onVisible),
    );
  });

  const dismissNudge = () => {
    setDismissedNudge(true);
    try {
      localStorage.setItem(GOOGLE_NUDGE_KEY, "1");
    } catch {
      // Private mode — the nudge simply returns next visit.
    }
  };

  const updatedAgo = () => timeAgo(tick());
  const todayLabel = () =>
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const unrepliedCount = () => peek(queue)?.length ?? 0;

  const isFirstRun = () =>
    !analytics.loading &&
    !analytics.error &&
    (peek(analytics)?.totalLinks ?? 0) === 0 &&
    (peek(analytics)?.totalQrScans ?? 0) === 0 &&
    (peek(queue) ?? []).length === 0;

  // Next best actions: reply row (when needed) + top 3 open SEO items.
  const nextActions = createMemo(() =>
    seoActionItems.filter((a) => a.status !== "completed").slice(0, 3),
  );

  // Review volume trend from the analytics breakdown (chronological).
  const trendPoints = createMemo(() => {
    const rows = [...(peek(analytics)?.breakdown ?? [])]
      .filter((r) => r.createdAt)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .slice(-8);
    return rows.map((r) => ({
      label: new Date(r.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: r.reviews ?? 0,
    }));
  });

  // Recent reviews: live unreplied Google reviews, else sample data.
  const recentReviews = createMemo(() => {
    const live = peek(queue) ?? [];
    if (live.length > 0) {
      return live.slice(0, 3).map((q) => ({
        id: q.id,
        name: q.name,
        rating: q.rating,
        preview: q.preview,
        meta: `Google · ${q.ago}`,
        initials: q.name
          .split(" ")
          .filter(Boolean)
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }));
    }
    return recentActivity.slice(0, 3).map((r) => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      preview: r.preview,
      meta: `${r.source} · ${r.ago}`,
      initials: r.initials,
    }));
  });

  const ratingValue = () => {
    const r = peek(business)?.rating ?? 0;
    return r > 0 ? r.toFixed(1) : "—";
  };

  return (
    <>
      <Title>Dashboard — Flonion</Title>
      <div class="mx-auto max-w-[1280px] space-y-6 px-4 pt-6 pb-10 sm:px-6">
        {/* Header: H1 is the business name; Google connection pill beside it. */}
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="truncate font-heading text-3xl font-semibold text-foreground">
                <Show when={peek(business)?.name} fallback="Dashboard">
                  {peek(business)!.name}
                </Show>
              </h1>
              <Show
                when={!googleConnected.loading}
                fallback={
                  <span class="tnum text-xs text-muted-foreground">
                    Checking Google…
                  </span>
                }
              >
                <Show
                  when={peek(googleConnected) === true}
                  fallback={
                    <Badge tone="neutral" icon={Unplug}>
                      Google not connected
                    </Badge>
                  }
                >
                  <Badge tone="success" icon={CheckCircle2}>
                    Google connected
                  </Badge>
                </Show>
              </Show>
            </div>
            <p class="tnum mt-1 text-sm text-muted-foreground">
              {todayLabel()} · Updated {updatedAgo()}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAll(true)}
              disabled={analytics.loading}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </Button>
            <ButtonLink href="/reviews/new" size="sm">
              Ask for a review
            </ButtonLink>
          </div>
        </div>

        {/* Google-connect nudge: dismissible, never blocks the page. */}
        <Show
          when={
            !googleConnected.loading &&
            peek(googleConnected) === false &&
            !dismissedNudge()
          }
        >
          <div class="flex flex-col gap-3 rounded-card border border-primary/25 bg-positive-muted p-4 sm:flex-row sm:items-center">
            <p class="flex-1 text-sm text-foreground">
              Connect Google to import reviews, reply from your inbox, and keep
              your SEO score live.
            </p>
            <div class="flex gap-2">
              <ButtonLink
                href={`/api/google/auth?returnTo=${encodeURIComponent("/dashboard")}`}
                rel="external"
                size="sm"
              >
                Connect Google
              </ButtonLink>
              <button
                type="button"
                onClick={dismissNudge}
                class="h-9 rounded-control px-3 text-sm font-medium text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted hover:text-foreground motion-reduce:transition-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Show>

        {/* KPI strip: 2×2 below md, 4 across on xl. Each tile resolves alone. */}
        <Show
          when={!analytics.loading || peek(analytics)}
          fallback={<SkeletonKpiRow count={4} />}
        >
          <Show
            when={!analytics.error}
            fallback={
              <WidgetError
                message="Couldn't load dashboard metrics."
                onRetry={() => refetchAnalytics()}
                retryLabel="Retry"
              />
            }
          >
            <section
              class="grid grid-cols-2 gap-4 xl:grid-cols-4"
              aria-label="Key metrics"
            >
              <KpiCard
                label="Avg rating"
                value={ratingValue()}
                icon={Star}
                trend={
                  (peek(business)?.reviewCount ?? 0) > 0
                    ? `${peek(business)!.reviewCount} reviews`
                    : undefined
                }
                trendLabel="Total Google reviews"
                loading={business.loading}
                updatedAgo={updatedAgo()}
              />
              <KpiCard
                label="Total reviews"
                value={`${peek(analytics)?.totalReviews ?? 0}`}
                icon={Inbox}
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
              <KpiCard
                label="QR scans (30d)"
                value={`${peek(analytics)?.totalQrScans ?? 0}`}
                icon={QrCode}
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
              {/* Unreplied reviews — links to the inbox filter per DS. */}
              <article
                class="flex min-h-28 flex-col justify-between rounded-card border border-border bg-card p-5 shadow-sm"
                aria-busy={queue.loading || undefined}
              >
                <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Inbox class="size-4" aria-hidden="true" />
                  <span>Unreplied reviews</span>
                </div>
                <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <strong class="tnum font-heading text-2xl font-semibold leading-none text-foreground">
                    {queue.loading ? "…" : `${unrepliedCount()}`}
                  </strong>
                </div>
                <a
                  href="/reviews/inbox?filter=unreplied"
                  class="mt-1 w-fit text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  View in inbox
                </a>
              </article>
            </section>
          </Show>
        </Show>

        {/* First-run checklist: never a blank chart (DS §6). */}
        <Show when={isFirstRun()}>
          <section
            aria-labelledby="getting-started-heading"
            class="rounded-card border border-border bg-card p-5 shadow-sm"
          >
            <h2
              id="getting-started-heading"
              class="font-heading text-lg font-semibold text-foreground"
            >
              Get your first reviews
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Three steps to a working review loop. Your numbers appear here as
              soon as customers start scanning.
            </p>
            <ol class="mt-4 grid gap-3 sm:grid-cols-3">
              <li class="flex items-start gap-3 rounded-card border border-border bg-background p-4">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                  aria-hidden="true"
                >
                  1
                </span>
                <span>
                  <span class="block text-sm font-medium text-foreground">
                    Print your QR
                  </span>
                  <ButtonLink
                    href="/reviews/new"
                    size="sm"
                    variant="ghost"
                    class="mt-1 px-0"
                  >
                    Create review link
                  </ButtonLink>
                </span>
              </li>
              <li class="flex items-start gap-3 rounded-card border border-border bg-background p-4">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                  aria-hidden="true"
                >
                  2
                </span>
                <span>
                  <span class="block text-sm font-medium text-foreground">
                    Connect Google
                  </span>
                  <ButtonLink
                    href={`/api/google/auth?returnTo=${encodeURIComponent("/dashboard")}`}
                    rel="external"
                    size="sm"
                    variant="ghost"
                    class="mt-1 px-0"
                  >
                    Connect now
                  </ButtonLink>
                </span>
              </li>
              <li class="flex items-start gap-3 rounded-card border border-border bg-background p-4">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                  aria-hidden="true"
                >
                  3
                </span>
                <span>
                  <span class="block text-sm font-medium text-foreground">
                    Invite your team
                  </span>
                  <ButtonLink
                    href="/settings/team"
                    size="sm"
                    variant="ghost"
                    class="mt-1 px-0"
                  >
                    Manage team
                  </ButtonLink>
                </span>
              </li>
            </ol>
          </section>
        </Show>

        {/* Next best actions (8) + rating trend (4). Actions first on mobile. */}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section aria-labelledby="next-actions-heading" class="lg:col-span-8">
            <CardHeader
              title="Next best actions"
              description="The highest-impact items first. Each links to its fix."
            />
            <h2 id="next-actions-heading" class="sr-only">
              Next best actions
            </h2>
            <ul class="grid gap-3">
              <Show when={unrepliedCount() > 0}>
                <li class="e1-enter flex flex-col gap-3 rounded-card border border-primary/25 bg-card p-5 shadow-sm sm:flex-row sm:items-center">
                  <span class="grid size-10 shrink-0 place-items-center rounded-control bg-primary/10 text-primary">
                    <Inbox size={18} aria-hidden="true" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-base font-medium text-foreground">
                      Reply to {unrepliedCount()}{" "}
                      {unrepliedCount() === 1 ? "review" : "reviews"}
                    </p>
                    <p class="mt-0.5 text-sm text-muted-foreground">
                      <Badge tone="destructive" class="mr-2">
                        High impact
                      </Badge>
                      Fresh replies lift your public rating and show customers
                      you listen.
                    </p>
                  </div>
                  <ButtonLink
                    href="/reviews/inbox?filter=unreplied"
                    size="sm"
                    class="shrink-0"
                  >
                    Reply now
                  </ButtonLink>
                </li>
              </Show>
              <For each={nextActions()}>
                {(action) => (
                  <li class="flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
                    <span class="grid size-10 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground">
                      <Dynamic
                        component={action.icon}
                        size={18}
                        aria-hidden="true"
                      />
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-base font-medium text-foreground">
                        {action.title}
                      </p>
                      <p class="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        <Badge
                          tone={
                            action.status === "high-priority"
                              ? "warning"
                              : "neutral"
                          }
                          class="mr-2"
                        >
                          {action.status === "high-priority"
                            ? "High impact"
                            : "Recommended"}
                        </Badge>
                        {action.description}
                      </p>
                    </div>
                    <ButtonLink
                      href="/marketing/seo"
                      size="sm"
                      variant="outline"
                      class="shrink-0"
                    >
                      {action.actionLabel ?? "Fix now"}
                    </ButtonLink>
                  </li>
                )}
              </For>
            </ul>
          </section>

          <div class="lg:col-span-4">
            <CardHeader
              title="Reviews trend"
              description="Collected reviews per link."
            />
            <ChartAdapter
              title="Reviews trend"
              points={trendPoints()}
              loading={analytics.loading}
              error={analytics.error ? "Couldn't load the trend." : undefined}
              onRetry={() => refetchAnalytics()}
            />
          </div>
        </div>

        {/* Recent reviews with sentiment chips + Draft reply. */}
        <section aria-labelledby="recent-reviews-heading">
          <CardHeader
            title="Recent reviews"
            description="Latest customer feedback with sentiment."
            action={
              <ButtonLink href="/reviews/inbox" size="sm" variant="outline">
                Open inbox
              </ButtonLink>
            }
          />
          <h2 id="recent-reviews-heading" class="sr-only">
            Recent reviews
          </h2>
          <Show when={queue.loading} fallback={null}>
            <SkeletonRows count={3} />
          </Show>
          <Show when={queue.error}>
            <WidgetError
              message="Couldn't load recent reviews."
              onRetry={() => refetchQueue()}
              retryLabel="Retry"
            />
          </Show>
          <Show when={!queue.loading && !queue.error}>
            <ul class="grid gap-3">
              <For each={recentReviews()}>
                {(review) => (
                  <li class="flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
                    <span
                      class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                      aria-hidden="true"
                    >
                      {review.initials}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span class="font-medium text-foreground">
                          {review.name}
                        </span>
                        <span class="tnum inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Star
                            size={12}
                            class="fill-star text-star"
                            aria-hidden="true"
                          />
                          {review.rating}/5
                        </span>
                        <SentimentBadge
                          sentiment={sentimentOf(review.rating)}
                        />
                      </p>
                      <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {review.preview}
                      </p>
                      <p class="tnum mt-1 text-xs text-muted-foreground">
                        {review.meta}
                      </p>
                    </div>
                    <ButtonLink
                      href="/reviews/inbox"
                      size="sm"
                      variant="outline"
                      class="shrink-0"
                    >
                      Draft reply
                    </ButtonLink>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>

        {/* Today: tasks + meetings side by side on lg, stacked below. */}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="today-tasks-heading">
            <CardHeader
              title="Today's tasks"
              description="Open work for your team."
              action={
                <ButtonLink
                  href="/marketplace/projects"
                  size="sm"
                  variant="outline"
                >
                  Open board
                </ButtonLink>
              }
            />
            <h2 id="today-tasks-heading" class="sr-only">
              Today's tasks
            </h2>
            <Show when={tasks.loading}>
              <SkeletonRows count={2} />
            </Show>
            <Show when={tasks.error}>
              <WidgetError
                message="Couldn't load tasks."
                onRetry={() => refetchTasks()}
                retryLabel="Retry"
              />
            </Show>
            <Show when={!tasks.loading && !tasks.error}>
              <Show
                when={(peek(tasks) ?? []).length > 0}
                fallback={
                  <p class="rounded-card border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
                    Nothing open — enjoy the quiet.
                  </p>
                }
              >
                <ul class="grid gap-2">
                  <For each={peek(tasks) ?? []}>
                    {(t) => (
                      <li class="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-sm">
                        <span class="grid size-9 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground">
                          <ListChecks size={16} aria-hidden="true" />
                        </span>
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-medium text-foreground">
                            {t.title}
                          </span>
                          <span class="tnum block text-xs capitalize text-muted-foreground">
                            {t.column}
                            {t.priority ? ` · ${t.priority} priority` : ""}
                          </span>
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>

          <section aria-labelledby="upcoming-meetings-heading">
            <CardHeader
              title="Upcoming meetings"
              description="Today and the days ahead."
              action={
                <ButtonLink
                  href="/collaborations/meeting-schedular"
                  size="sm"
                  variant="outline"
                >
                  Scheduler
                </ButtonLink>
              }
            />
            <h2 id="upcoming-meetings-heading" class="sr-only">
              Upcoming meetings
            </h2>
            <Show when={meetings.loading}>
              <SkeletonRows count={2} />
            </Show>
            <Show when={meetings.error}>
              <WidgetError
                message="Couldn't load meetings."
                onRetry={() => refetchMeetings()}
                retryLabel="Retry"
              />
            </Show>
            <Show when={!meetings.loading && !meetings.error}>
              <Show
                when={(peek(meetings) ?? []).length > 0}
                fallback={
                  <p class="rounded-card border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
                    No upcoming meetings.
                  </p>
                }
              >
                <ul class="grid gap-2">
                  <For each={peek(meetings) ?? []}>
                    {(m) => (
                      <li class="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-sm">
                        <span class="grid size-9 shrink-0 place-items-center rounded-control bg-primary/10 text-primary">
                          <CalendarDays size={16} aria-hidden="true" />
                        </span>
                        <span class="min-w-0">
                          <span class="block truncate text-sm font-medium text-foreground">
                            {m.title}
                          </span>
                          <span class="tnum block text-xs text-muted-foreground">
                            {m.time}
                          </span>
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>
        </div>

        {/* Polite live region: announces manual refreshes only (DS §6). */}
        <p aria-live="polite" aria-atomic="true" class="sr-only">
          {announcement()}
        </p>

        <Show
          when={!business.loading && !business.error && !peek(business)?.name}
        >
          <WidgetError
            message="Couldn't load your business profile."
            onRetry={() => refetchBusiness()}
            retryLabel="Retry"
          />
        </Show>
      </div>
    </>
  );
}
