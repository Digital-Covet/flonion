import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { IconPlus, IconRefresh } from "@tabler/icons-solidjs";
import {
  createMemo,
  createResource,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import {
  type AnalyticsData,
  funnelOf,
  inRange,
  loadCampaigns,
  platformRows,
  RANGE_LABELS,
  RANGE_OPTIONS,
  type Range,
  type SortDir,
  type SortKey,
  sortRows,
  totalsOf,
  type View,
  viewFrom,
  viewParams,
} from "~/components/analytics/data";
import {
  Funnel,
  FunnelSkeleton,
  KpiSkeleton,
  KpiStrip,
  LinksTable,
  NoLinksInRange,
  NoLinksYet,
  NoPlatformRedirects,
  PlatformPanel,
  SortSelect,
  TableSkeleton,
} from "~/components/analytics/widgets";
import { useApp } from "~/components/app/context";
import { isLoading, settled } from "~/components/dashboard/data";
import { Widget, WidgetError } from "~/components/dashboard/ui";
import { btnPrimary, btnSecondary } from "~/components/onboarding/ui";
import { Segmented } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

/** Campaign counts change while the owner is away, so a refocus refetches. */
const FOCUS_REFRESH_MS = 60_000;

export default function AnalyticsPage() {
  const { business } = useApp();
  const [params, setParams] = useSearchParams();

  // Analytics is its own call and doesn't wait on the business: the page works
  // for a member whose business details are still loading.
  const [data, { refetch }] = createResource<AnalyticsData>(loadCampaigns);

  const [message, setMessage] = createSignal("");
  const view = createMemo(() => viewFrom(params));
  const d = () => settled(data);

  onMount(() => {
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      refetch();
    };
    document.addEventListener("visibilitychange", onFocus);
    onCleanup(() => document.removeEventListener("visibilitychange", onFocus));
  });

  function update(next: Partial<View>) {
    setParams(viewParams({ ...view(), ...next }), { replace: true });
  }

  function setRange(range: Range) {
    update({ range });
    announce(`Showing ${RANGE_LABELS[range]}`);
  }

  function setSort(sort: SortKey, dir: SortDir) {
    update({ sort, dir });
    const label = dir === "asc" ? "lowest first" : "highest first";
    announce(`Sorted by ${sort === "rate" ? "conversion" : sort}, ${label}`);
  }

  // Re-announce even when the text repeats, so the live region always fires.
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  // ── Derived
  const all = () => d()?.reviews ?? [];
  const ranged = createMemo(() => inRange(all(), view().range));
  const totals = createMemo(() => totalsOf(ranged()));
  const funnel = createMemo(() => funnelOf(totals()));
  const platforms = createMemo(() => platformRows(ranged()));
  const rows = createMemo(() => sortRows(ranged(), view().sort, view().dir));

  /**
   * QR scans counted on the business itself (the printed sheet) rather than on
   * one link. They have no creation date, so they only show for "all time".
   */
  const unattributedScans = () => {
    const info = d();
    if (!info || view().range !== "all") return 0;
    const perLink = all().reduce((sum, r) => sum + r.qrScans, 0);
    return Math.max(0, info.totalQrScans - perLink);
  };

  const hasLinks = () => all().length > 0;
  const emptyInRange = () => hasLinks() && ranged().length === 0;
  const failed = () => data.state === "errored";
  const busy = () => isLoading(data);

  return (
    <>
      <Title>Analytics · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Analytics
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              What happens after a customer of{" "}
              <span class="font-medium text-text">
                {settled(business)?.businessName || "your business"}
              </span>{" "}
              scans a QR code: who opens the page, who writes a review, and who
              posts it.
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                refetch();
                announce("Refreshing analytics");
              }}
              disabled={busy()}
              class={cn(
                btnSecondary,
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <IconRefresh aria-hidden="true" class="size-5" />
              Refresh
            </button>
            <A href="/reviews/new" class={btnPrimary}>
              <IconPlus aria-hidden="true" class="size-5" />
              New review request
            </A>
          </div>
        </header>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <Segmented
            legend="Date range"
            name="analytics-range"
            class="lg:w-auto"
            value={view().range}
            onChange={setRange}
            options={RANGE_OPTIONS}
          />
          <p class="text-sm text-text-muted">
            <Show when={!busy() && !failed()} fallback="Loading your links…">
              <span class="font-mono tabular-nums">{ranged().length}</span>{" "}
              {ranged().length === 1 ? "link" : "links"} created in{" "}
              {RANGE_LABELS[view().range]}
            </Show>
          </p>
        </div>

        <Switch>
          <Match when={failed()}>
            <div class="rounded-lg border border-border bg-surface p-4 md:p-5">
              <WidgetError what="your campaign analytics" onRetry={refetch} />
            </div>
          </Match>

          <Match when={busy()}>
            <div class="flex flex-col gap-4">
              <KpiSkeleton />
              <div class="rounded-lg border border-border bg-surface p-4 md:p-5">
                <FunnelSkeleton />
              </div>
              <div class="rounded-lg border border-border bg-surface p-4 md:p-5">
                <TableSkeleton rows={5} />
              </div>
            </div>
          </Match>

          <Match when={!hasLinks()}>
            <div class="rounded-lg border border-border bg-surface">
              <NoLinksYet />
            </div>
          </Match>

          <Match when={emptyInRange()}>
            <div class="rounded-lg border border-border bg-surface">
              <NoLinksInRange
                range={RANGE_LABELS[view().range]}
                onClear={() => setRange("all")}
              />
            </div>
          </Match>

          <Match when={true}>
            <KpiStrip
              totals={totals()}
              unattributedScans={unattributedScans()}
            />

            <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
              <Widget
                id="analytics-funnel"
                title="From scan to posted review"
                class="lg:col-span-7"
                meta={
                  <span class="text-sm text-text-muted">
                    {RANGE_LABELS[view().range]}
                  </span>
                }
              >
                <Funnel stages={funnel()} />
                <p class="mt-5 text-xs text-pretty text-text-muted">
                  Counted from this page's own tracking. A customer who posts on
                  Google after closing the page isn't counted, so the last step
                  is a floor, not a total.
                </p>
              </Widget>

              <Widget
                id="analytics-platforms"
                title="Where customers posted"
                action={{ href: "/settings", label: "Edit platforms" }}
                class="lg:col-span-5"
              >
                <Show
                  when={platforms().length > 0}
                  fallback={<NoPlatformRedirects />}
                >
                  <PlatformPanel rows={platforms()} />
                </Show>
              </Widget>
            </div>

            <Widget
              id="analytics-links"
              title="Every link"
              meta={
                <span class="text-sm text-text-muted">
                  <span class="font-mono tabular-nums">{rows().length}</span>{" "}
                  {rows().length === 1 ? "request" : "requests"}
                </span>
              }
            >
              <SortSelect
                sort={view().sort}
                dir={view().dir}
                onChange={setSort}
                class="mb-4 sm:max-w-60 md:hidden"
              />
              <LinksTable
                rows={rows()}
                sort={view().sort}
                dir={view().dir}
                onSort={setSort}
              />
            </Widget>
          </Match>
        </Switch>
      </div>
    </>
  );
}
