import { Title } from "@solidjs/meta";
import { For, Show, createSignal, onMount } from "solid-js";
import BarChart3 from "lucide-solid/icons/bar-chart-3";
import Eye from "lucide-solid/icons/eye";
import MessageSquare from "lucide-solid/icons/message-square";
import Link2 from "lucide-solid/icons/link-2";
import Star from "lucide-solid/icons/star";

interface ReviewAnalyticsRow {
  id: string;
  text: string;
  rating: number;
  reviewerName: string | null;
  visits: number;
  reviews: number;
  qrScans: number;
  createdAt: string;
}

interface AnalyticsData {
  totalVisits: number;
  totalReviews: number;
  totalQrScans: number;
  totalLinks: number;
  reviews: ReviewAnalyticsRow[];
}

function StatCard(props: {
  label: string;
  value: number;
  icon: typeof BarChart3;
  accent: string;
}) {
  return (
    <div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        class={`flex size-12 items-center justify-center rounded-xl ${props.accent}`}
      >
        <props.icon size={22} />
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-900">{props.value.toLocaleString()}</p>
        <p class="text-xs text-slate-500">{props.label}</p>
      </div>
    </div>
  );
}

function StarRating(props: { rating: number }) {
  return (
    <div class="flex items-center gap-0.5">
      <For each={Array.from({ length: 5 })}>
        {(_, i) => (
          <Star
            size={14}
            class={
              i() < props.rating
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            }
          />
        )}
      </For>
    </div>
  );
}

function EmptyState() {
  return (
    <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
      <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
        <BarChart3 class="size-8 text-slate-400" />
      </div>
      <h3 class="text-lg font-semibold text-slate-900">No analytics yet</h3>
      <p class="mt-2 max-w-sm mx-auto text-sm text-slate-500">
        Share a review link or QR code to start tracking visitor activity.
        Analytics will appear here once people interact with your links.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div class="space-y-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <For each={[1, 2, 3]}>
          {() => (
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-center gap-4">
                <div class="size-12 animate-pulse rounded-xl bg-slate-100" />
                <div class="space-y-2">
                  <div class="h-7 w-16 animate-pulse rounded bg-slate-100" />
                  <div class="h-3 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="space-y-3">
          <For each={[1, 2, 3, 4, 5]}>
            {() => (
              <div class="flex items-center gap-4 py-2">
                <div class="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div class="h-4 w-12 animate-pulse rounded bg-slate-100" />
                <div class="h-4 w-12 animate-pulse rounded bg-slate-100" />
                <div class="h-4 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = createSignal<AnalyticsData | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await fetch("/api/reviews/analytics");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  });

  return (
    <>
      <Title>Analytics — Flonion</Title>
      <div class="mx-auto max-w-7xl space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Campaign Analytics
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Track how many people interact with your review links and QR codes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetch("/api/reviews/analytics")
                .then((r) => r.json())
                .then(setData)
                .finally(() => setLoading(false));
            }}
            class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <Show when={!loading()} fallback={<LoadingSkeleton />}>
          <Show when={data()} fallback={<EmptyState />}>
            {(analytics) => (
              <div class="space-y-6">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <StatCard
                    label="QR Code Scans"
                    value={analytics().totalQrScans}
                    icon={BarChart3}
                    accent="bg-amber-50 text-amber-600"
                  />
                  <StatCard
                    label="Total Visits"
                    value={analytics().totalVisits}
                    icon={Eye}
                    accent="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    label="Reviews Submitted"
                    value={analytics().totalReviews}
                    icon={MessageSquare}
                    accent="bg-emerald-50 text-emerald-600"
                  />
                  <StatCard
                    label="Review Links"
                    value={analytics().totalLinks}
                    icon={Link2}
                    accent="bg-violet-50 text-violet-600"
                  />
                </div>

                <Show when={analytics().reviews.length > 0}>
                  <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div class="border-b border-slate-100 px-6 py-4">
                      <h2 class="text-base font-semibold text-slate-900">
                        Per-Link Breakdown
                      </h2>
                      <p class="text-xs text-slate-500">
                        QR scans, visit, and review counts for each shared link.
                      </p>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-slate-100 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            <th class="px-6 py-3">Review</th>
                            <th class="px-6 py-3">Rating</th>
                            <th class="px-6 py-3 text-right">QR Scans</th>
                            <th class="px-6 py-3 text-right">Visits</th>
                            <th class="px-6 py-3 text-right">Reviews</th>
                            <th class="px-6 py-3 text-right">Created</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                          <For each={analytics().reviews}>
                            {(row) => (
                              <tr class="transition-colors hover:bg-slate-50/50">
                                <td class="px-6 py-3.5">
                                  <div class="max-w-xs truncate font-medium text-slate-900">
                                    {row.text || (
                                      <span class="text-slate-400 italic">
                                        Empty review
                                      </span>
                                    )}
                                  </div>
                                  <Show when={row.reviewerName}>
                                    <p class="text-xs text-slate-500">
                                      by {row.reviewerName}
                                    </p>
                                  </Show>
                                </td>
                                <td class="px-6 py-3.5">
                                  <StarRating rating={row.rating} />
                                </td>
                                <td class="px-6 py-3.5 text-right font-medium text-slate-700">
                                  {row.qrScans}
                                </td>
                                <td class="px-6 py-3.5 text-right font-medium text-slate-700">
                                  {row.visits}
                                </td>
                                <td class="px-6 py-3.5 text-right font-medium text-slate-700">
                                  {row.reviews}
                                </td>
                                <td class="px-6 py-3.5 text-right text-slate-500">
                                  {new Date(row.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </>
  );
}
