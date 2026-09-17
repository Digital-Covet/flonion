import { Title } from "@solidjs/meta";
import BarChart3 from "lucide-solid/icons/bar-chart-3";
import ClipboardCheck from "lucide-solid/icons/clipboard-check";
import Download from "lucide-solid/icons/download";
import ExternalLink from "lucide-solid/icons/external-link";
import Eye from "lucide-solid/icons/eye";
import MessageSquare from "lucide-solid/icons/message-square";
import MousePointerClick from "lucide-solid/icons/mouse-pointer-click";
import QrCode from "lucide-solid/icons/qr-code";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import Star from "lucide-solid/icons/star";
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
import { isServer } from "solid-js/web";
import { ChartAdapter } from "~/components/charts/ChartAdapter";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, KpiCard } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  SkeletonChart,
  SkeletonKpiRow,
  SkeletonRows,
  WidgetError,
} from "~/components/ui/skeleton";
import { DataTable } from "~/components/ui/table";
import { notify } from "~/components/ui/toast";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";

interface ReviewAnalyticsRow {
  id: string;
  text: string;
  rating: number;
  reviewerName: string | null;
  visits: number;
  reviews: number;
  qrScans: number;
  redirects: number;
  aiCopies: number;
  platformRedirects: Record<string, number>;
  createdAt: string;
}

interface AnalyticsData {
  totalVisits: number;
  totalReviews: number;
  totalQrScans: number;
  totalRedirects: number;
  totalAiCopies: number;
  totalPlatformRedirects: Record<string, number>;
  totalLinks: number;
  reviews: ReviewAnalyticsRow[];
}

// Read a resource without registering with <Suspense> — same guard as the
// dashboard: a suspending read flips the route Suspense to its fallback while
// hydrating, which crashes the next lucide icon render.
function peek<T>(resource: Resource<T>): T | undefined {
  return resource.state === "ready" || resource.state === "refreshing"
    ? resource.latest
    : undefined;
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  if (isServer) {
    return {
      totalVisits: 0,
      totalReviews: 0,
      totalQrScans: 0,
      totalRedirects: 0,
      totalAiCopies: 0,
      totalPlatformRedirects: {},
      totalLinks: 0,
      reviews: [],
    };
  }
  const res = await fetch("/api/reviews/analytics");
  if (!res.ok) throw new Error(`Analytics failed (${res.status})`);
  return (await res.json()) as AnalyticsData;
}

// DS §2 semantic rule: ratings always show the number next to the stars.
function StarRating(props: { rating: number }) {
  return (
    <span class="inline-flex items-center gap-1.5">
      <span
        class="inline-flex items-center gap-0.5"
        role="img"
        aria-label={`${props.rating} out of 5 stars`}
      >
        <For each={Array.from({ length: 5 })}>
          {(_, i) => (
            <Star
              size={14}
              aria-hidden="true"
              class={
                i() < props.rating
                  ? "fill-star text-star"
                  : "fill-border text-border"
              }
            />
          )}
        </For>
      </span>
      <span class="tnum text-xs text-muted-foreground">
        {props.rating.toFixed(1)}/5
      </span>
    </span>
  );
}

function toCsv(data: AnalyticsData): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const platformSlugs = REVIEW_PLATFORMS.map((p) => p.slug);
  const header = [
    "id",
    "text",
    "rating",
    "reviewer",
    "visits",
    "submissions",
    "qrScans",
    "redirects",
    "aiCopies",
    ...platformSlugs.map((s) => `redirect_${s}`),
    "createdAt",
  ].join(",");
  const lines = data.reviews.map((r) =>
    [
      esc(r.id),
      esc(r.text),
      r.rating,
      esc(r.reviewerName ?? ""),
      r.visits,
      r.reviews,
      r.qrScans,
      r.redirects,
      r.aiCopies,
      ...platformSlugs.map((s) => r.platformRedirects[s] ?? 0),
      esc(r.createdAt),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

const STALE_MS = 5 * 60 * 1000;

export function AnalyticsPage() {
  const [analytics, { refetch }] = createResource(fetchAnalytics);
  const [tick, setTick] = createSignal(Date.now());
  const [lastFetch, setLastFetch] = createSignal(0);
  const [announcement, setAnnouncement] = createSignal("");

  const refresh = (announce = false) => {
    refetch();
    const now = Date.now();
    setTick(now);
    setLastFetch(now);
    if (announce) {
      const a = peek(analytics);
      setAnnouncement(
        `Analytics refreshed. ${a?.totalVisits ?? 0} visits, ${a?.totalReviews ?? 0} submissions, ${a?.totalRedirects ?? 0} redirects.`,
      );
      notify("success", "Analytics refreshed");
    }
  };

  // DS §6: no polling — refresh on focus only when data is older than 5 min.
  onMount(() => {
    refresh();
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetch() > STALE_MS) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", onVisible),
    );
  });

  const updatedAgo = () => {
    const mins = Math.floor((Date.now() - tick()) / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1m ago";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const isEmpty = () =>
    !analytics.loading &&
    !analytics.error &&
    (peek(analytics)?.totalLinks ?? 0) === 0;

  // Funnel helpers — the core job is turning visits into public reviews.
  const submitRate = () => {
    const a = peek(analytics);
    if (!a || a.totalVisits === 0) return null;
    return `${Math.round((a.totalReviews / a.totalVisits) * 100)}% submit rate`;
  };
  const redirectRate = () => {
    const a = peek(analytics);
    if (!a || a.totalReviews === 0) return null;
    return `${Math.round((a.totalRedirects / a.totalReviews) * 100)}% redirect`;
  };

  // The ONE chart (DS §6): conversion funnel. Built from totals so it always
  // has shape when there is any activity; per-link detail lives in the table.
  const funnelPoints = createMemo(() => {
    const a = peek(analytics);
    return [
      { label: "Scans", value: a?.totalQrScans ?? 0 },
      { label: "Visits", value: a?.totalVisits ?? 0 },
      { label: "Submissions", value: a?.totalReviews ?? 0 },
      { label: "Redirects", value: a?.totalRedirects ?? 0 },
    ];
  });

  const platformTotals = createMemo(() => {
    const totals = peek(analytics)?.totalPlatformRedirects ?? {};
    return REVIEW_PLATFORMS.map((p) => ({
      slug: p.slug,
      label: p.label,
      count: totals[p.slug] ?? 0,
    }));
  });

  const exportCsv = () => {
    const current = peek(analytics);
    if (!current) return;
    const blob = new Blob([toCsv(current)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("success", "Analytics exported");
  };

  return (
    <>
      <Title>Analytics — Flonion</Title>
      <div class="mx-auto max-w-[1280px] space-y-6 px-4 pt-6 pb-10 sm:px-6">
        {/* Header: H1 + description + per-DS actions. */}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <h1 class="font-heading text-3xl font-semibold text-foreground">
              Analytics
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Track how many people scan, visit, submit, and redirect from your
              review links.
            </p>
            <p class="tnum mt-1 text-xs text-muted-foreground">
              Updated {updatedAgo()}
              <Show when={(peek(analytics)?.totalLinks ?? 0) > 0}>
                {" "}
                · {peek(analytics)!.totalLinks}{" "}
                {peek(analytics)!.totalLinks === 1 ? "link" : "links"} ·{" "}
                {peek(analytics)!.totalAiCopies} AI drafts copied
              </Show>
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={analytics.loading || !peek(analytics)}
            >
              <Download size={16} aria-hidden="true" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refresh(true)}
              loading={analytics.loading}
              loadingLabel="Refreshing…"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI strip: 4 cards, 2×2 below md (DS §6 dashboard pattern). */}
        <Show
          when={!analytics.loading || peek(analytics)}
          fallback={<SkeletonKpiRow count={4} />}
        >
          <Show
            when={!analytics.error}
            fallback={
              <WidgetError
                message="Couldn't load analytics. Check your connection and retry."
                onRetry={() => refresh()}
                retryLabel="Retry"
              />
            }
          >
            <section
              class="grid grid-cols-2 gap-4 xl:grid-cols-4"
              aria-label="Key metrics"
            >
              <KpiCard
                label="QR scans"
                value={`${peek(analytics)?.totalQrScans ?? 0}`}
                icon={QrCode}
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
              <KpiCard
                label="Visits"
                value={`${peek(analytics)?.totalVisits ?? 0}`}
                icon={Eye}
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
              <KpiCard
                label="Submissions"
                value={`${peek(analytics)?.totalReviews ?? 0}`}
                icon={MessageSquare}
                trend={submitRate() ?? undefined}
                trendLabel="Share of visits that became submissions"
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
              <KpiCard
                label="Redirects"
                value={`${peek(analytics)?.totalRedirects ?? 0}`}
                icon={ExternalLink}
                trend={redirectRate() ?? undefined}
                trendLabel="Share of submissions that redirected to a platform"
                loading={analytics.loading}
                updatedAgo={updatedAgo()}
              />
            </section>
          </Show>
        </Show>

        {/* Guided empty state — never a blank chart (DS anti-pattern §1.4). */}
        <Show when={isEmpty()}>
          <EmptyState
            icon={BarChart3}
            title="No analytics yet"
            description="Share a review link or print your QR code. Scans, visits, and submissions will appear here as soon as customers interact with your links."
            primaryLabel="Create a review link"
            primaryHref="/reviews/new"
          />
        </Show>

        {/* Chart (8) + platform breakdown (4) — one chart only (DS §6). */}
        <Show when={!isEmpty()}>
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div class="lg:col-span-8">
              <CardHeader
                title="Conversion funnel"
                description="From QR scan to platform redirect."
              />
              <Show
                when={!analytics.loading || peek(analytics)}
                fallback={<SkeletonChart />}
              >
                <ChartAdapter
                  title="Conversion funnel"
                  points={funnelPoints()}
                  loading={analytics.loading}
                  error={
                    analytics.error ? "Couldn't load the trend." : undefined
                  }
                  onRetry={() => refresh()}
                />
              </Show>
            </div>
            <section
              aria-labelledby="platform-breakdown-heading"
              class="lg:col-span-4"
            >
              <CardHeader
                title="Redirects by platform"
                description="Where customers go after submitting."
              />
              <h2 id="platform-breakdown-heading" class="sr-only">
                Redirects by platform
              </h2>
              <Show
                when={!analytics.loading || peek(analytics)}
                fallback={<SkeletonRows count={3} />}
              >
                <Show
                  when={!analytics.error}
                  fallback={
                    <WidgetError
                      message="Couldn't load platform breakdown."
                      onRetry={() => refresh()}
                      retryLabel="Retry"
                    />
                  }
                >
                  <Card padded={false}>
                    <ul class="divide-y divide-border">
                      <For each={platformTotals()}>
                        {(p) => (
                          <li class="flex items-center gap-3 px-4 py-3">
                            <span class="grid size-9 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground">
                              <MousePointerClick size={16} aria-hidden="true" />
                            </span>
                            <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                              {p.label}
                            </span>
                            <span class="tnum text-sm font-medium text-foreground">
                              {p.count}
                            </span>
                          </li>
                        )}
                      </For>
                      <li class="flex items-center gap-3 px-4 py-3">
                        <span class="grid size-9 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground">
                          <ClipboardCheck size={16} aria-hidden="true" />
                        </span>
                        <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          AI drafts copied
                        </span>
                        <span class="tnum text-sm font-medium text-foreground">
                          {peek(analytics)?.totalAiCopies ?? 0}
                        </span>
                      </li>
                    </ul>
                  </Card>
                </Show>
              </Show>
            </section>
          </div>

          {/* Per-link table — numbers right-aligned + tabular (DS §2). */}
          <Show
            when={!analytics.loading || peek(analytics)}
            fallback={<SkeletonRows count={4} />}
          >
            <Show when={!analytics.error} fallback={null}>
              <Show
                when={(peek(analytics)?.reviews.length ?? 0) > 0}
                fallback={null}
              >
                <section aria-labelledby="per-link-heading">
                  <CardHeader
                    title="Per-link breakdown"
                    description="QR scans, visits, submissions, and redirects for each shared link."
                  />
                  <h2 id="per-link-heading" class="sr-only">
                    Per-link breakdown
                  </h2>
                  <DataTable
                    caption="Per-link breakdown of visits, scans, submissions and redirects"
                    columns={[
                      {
                        header: "Review",
                        render: (row) => (
                          <span>
                            <Show
                              when={row.reviews > 0}
                              fallback={
                                <span class="italic text-muted-foreground">
                                  Awaiting submission
                                </span>
                              }
                            >
                              <span class="block max-w-xs truncate font-medium text-foreground">
                                {row.text || (
                                  <span class="italic text-muted-foreground">
                                    Empty review
                                  </span>
                                )}
                              </span>
                            </Show>
                            <Show
                              when={
                                row.reviews > 0 ||
                                row.visits > 0 ||
                                row.qrScans > 0
                              }
                            >
                              <span class="block text-xs text-muted-foreground">
                                by {row.reviewerName || "Anonymous"}
                              </span>
                            </Show>
                          </span>
                        ),
                      },
                      {
                        header: "Rating",
                        render: (row) => <StarRating rating={row.rating} />,
                      },
                      {
                        header: "QR Scans",
                        numeric: true,
                        render: (row) => `${row.qrScans}`,
                      },
                      {
                        header: "Visits",
                        numeric: true,
                        render: (row) => `${row.visits}`,
                      },
                      {
                        header: "Submissions",
                        numeric: true,
                        render: (row) => `${row.reviews}`,
                      },
                      {
                        header: "AI Copies",
                        numeric: true,
                        render: (row) => `${row.aiCopies}`,
                      },
                      {
                        header: "Redirects",
                        numeric: true,
                        render: (row) => `${row.redirects}`,
                      },
                      {
                        header: "Created",
                        numeric: true,
                        render: (row) => (
                          <time class="tnum" dateTime={row.createdAt}>
                            {new Date(row.createdAt).toLocaleDateString()}
                          </time>
                        ),
                      },
                    ]}
                    rows={peek(analytics)!.reviews}
                    rowKey={(row) => row.id}
                    renderCard={(row) => (
                      <div class="grid gap-1">
                        <p class="truncate text-sm font-medium text-foreground">
                          {row.text || "Awaiting submission"}
                        </p>
                        <p class="tnum text-xs text-muted-foreground">
                          {row.rating.toFixed(1)}/5 · {row.visits} visits ·{" "}
                          {row.reviews} submissions · {row.redirects} redirects
                        </p>
                        <p class="text-xs text-muted-foreground">
                          by {row.reviewerName || "Anonymous"}
                        </p>
                      </div>
                    )}
                  />
                </section>
              </Show>
            </Show>
          </Show>
        </Show>

        {/* Polite live region: announces manual refreshes only (DS §6). */}
        <p aria-live="polite" aria-atomic="true" class="sr-only">
          {announcement()}
        </p>
      </div>
    </>
  );
}
