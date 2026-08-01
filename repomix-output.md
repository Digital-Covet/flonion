# Directory Structure
```
src/components/dashboard/QuickActions.tsx
src/components/dashboard/RecentActivity.tsx
src/components/review/metric-card.tsx
src/components/review/review-source-chart.tsx
src/components/review/sentiment-trend-chart.tsx
src/components/seo/ActionList.tsx
src/components/seo/ProgressTracker.tsx
src/constants/index.ts
src/features/dashboard/DashboardPage.tsx
src/features/reviews/review-data.ts
src/routes/(app).tsx
src/routes/(app)/dashboard.tsx
```

# Files

## File: src/routes/(app).tsx
```typescript
import { Suspense } from "solid-js";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { MobileNavigation } from "~/components/layout/mobile-navigation";
import LogoComponent from "~/assets/logo";
export default function AppLayout(props: { children: any }) {
  return (
    <div class="flex min-h-dvh bg-background text-foreground">
      <AppSidebar />
      <div class="flex min-w-0 flex-1 flex-col lg:h-dvh">
        <header class="flex items-center gap-3 border-b border-border bg-background px-4 py-4 sm:px-6 lg:hidden">
          <MobileNavigation />
          <LogoComponent class="h-8 w-auto" />
        </header>
        <main class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Suspense>
            {props.children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

## File: src/routes/(app)/dashboard.tsx
```typescript
import DashboardPage from "~/features/dashboard/DashboardPage";
export default function DashboardRoute() {
  return <DashboardPage />;
}
```

## File: src/components/dashboard/QuickActions.tsx
```typescript
import { For } from "solid-js";
import { quickActions } from "~/features/dashboard/data";
export function QuickActions() {
  return (
    <section
      aria-labelledby="quick-actions-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <h2
        id="quick-actions-heading"
        class="text-lg font-semibold text-foreground"
      >
        Quick Actions
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <For each={quickActions}>
          {(action) => (
            <a
              href={action.href}
              class="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
            >
              <action.icon size={18} class="text-primary" />
              <span class="text-sm font-medium text-foreground">
                {action.label}
              </span>
              <span class="text-xs text-muted-foreground">
                {action.description}
              </span>
            </a>
          )}
        </For>
      </div>
    </section>
  );
}
```

## File: src/components/dashboard/RecentActivity.tsx
```typescript
import { For, Show } from "solid-js";
import Star from "lucide-solid/icons/star";
import { recentActivity } from "~/features/dashboard/data";
const ratingColorClasses: Record<number, string> = {
  5: "text-primary",
  4: "text-primary",
  3: "text-muted-foreground",
  2: "text-destructive",
  1: "text-destructive",
};
export function RecentActivity() {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <h2
          id="recent-activity-heading"
          class="text-lg font-semibold text-foreground"
        >
          Recent Activity
        </h2>
        <a
          href="/reviews/inbox"
          class="text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          View all
        </a>
      </div>
      <ul class="mt-4 divide-y divide-border">
        <For each={recentActivity}>
          {(review) => (
            <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {review.initials}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground truncate">
                    {review.name}
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {review.ago}
                  </span>
                </div>
                <div class="mt-0.5 flex items-center gap-1.5">
                  <For each={[1, 2, 3, 4, 5]}>
                    {(i) => (
                      <Star
                        size={12}
                        class={
                          i <= review.rating
                            ? `${ratingColorClasses[review.rating]} fill-current`
                            : "text-muted-foreground/30"
                        }
                      />
                    )}
                  </For>
                  <span class="ml-1 text-xs text-muted-foreground">
                    {review.source}
                  </span>
                </div>
                <p class="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {review.preview}
                </p>
              </div>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
```

## File: src/components/review/metric-card.tsx
```typescript
import Plus from "lucide-solid/icons/plus";
import TrendingDown from "lucide-solid/icons/trending-down";
import TrendingUp from "lucide-solid/icons/trending-up";
import { Show } from "solid-js";
import type { Metric } from "@/features/reviews/review-types";
export function MetricCard(props: { metric: Metric }) {
  const Icon = props.metric.icon;
  const isPositive = () => props.metric.trendDirection === "positive";
  return (
    <article class="flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
      <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon class="size-4" aria-hidden="true" />
        <span>{props.metric.label}</span>
      </div>
      <div class="flex items-end gap-3">
        <strong class="text-2xl leading-none tracking-tight text-foreground">
          {props.metric.value}
        </strong>
        <span
          class={`flex items-center gap-1 text-xs font-semibold ${isPositive() ? "text-positive" : "text-destructive"
            }`}
        >
          <Show
            when={isPositive()}
            fallback={<TrendingDown class="size-3.5" aria-hidden="true" />}
          >
            <TrendingUp class="size-3.5" aria-hidden="true" />
          </Show>
          {props.metric.trend}
        </span>
      </div>
    </article>
  );
}
export function DisabledMetricCard() {
  return (
    <article
      aria-disabled="true"
      class="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center"
    >
      <Plus class="size-5 text-muted-foreground" aria-hidden="true" />
      <p class="mt-1 text-sm font-medium text-muted-foreground">Add metric</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Custom metrics require configuration.
      </p>
    </article>
  );
}
```

## File: src/components/review/review-source-chart.tsx
```typescript
import { For } from "solid-js";
import { reviewSources } from "@/features/reviews/review-data";
const sourceColorClasses = {
  primary: "bg-primary",
  info: "bg-info",
  purple: "bg-purple",
} as const;
const sourceStrokeColors = {
  primary: "#0f766e",
  info: "#2563eb",
  purple: "#7c3aed",
} as const;
export function ReviewSourceChart() {
  let cumulativeOffset = 0;
  const chartSegments = reviewSources.map((source) => {
    const offset = cumulativeOffset;
    cumulativeOffset += source.percentage;
    return {
      ...source,
      offset,
    };
  });
  const sourceSummary = reviewSources
    .map((source) => `${source.name} ${source.percentage}%`)
    .join(", ");
  return (
    <section
      aria-labelledby="review-sources-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <h2 id="review-sources-heading" class="text-lg font-semibold text-foreground">
        Review Sources
      </h2>
      <div class="mt-5 flex flex-col items-center">
        <div class="relative size-40">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Review source distribution: ${sourceSummary}`}
            class="size-full -rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e2e8f0"
              stroke-width="16"
            />
            <For each={chartSegments}>
              {(source) => (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  pathLength="100"
                  stroke={sourceStrokeColors[source.color]}
                  stroke-width="16"
                  stroke-dasharray={`${source.percentage} ${100 - source.percentage}`}
                  stroke-dashoffset={-source.offset}
                />
              )}
            </For>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-semibold tracking-tight text-foreground">1.2K</span>
            <span class="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
        <ul class="mt-5 w-full space-y-3">
          <For each={reviewSources}>
            {(source) => (
              <li class="flex items-center justify-between gap-3 text-sm">
                <span class="flex items-center gap-2 text-muted-foreground">
                  <span
                    class={`size-3 rounded-sm ${sourceColorClasses[source.color]}`}
                    aria-hidden="true"
                  />
                  {source.name}
                </span>
                <strong class="text-foreground">{source.percentage}%</strong>
              </li>
            )}
          </For>
        </ul>
      </div>
      <p class="sr-only">Review source values: {sourceSummary}.</p>
    </section>
  );
}
```

## File: src/components/review/sentiment-trend-chart.tsx
```typescript
import { For } from "solid-js";
import { sentimentTrend } from "@/features/reviews/review-data";
export function SentimentTrendChart() {
  const summary = sentimentTrend
    .map(
      (point) =>
        `${point.date}: ${point.positive} positive and ${point.negative} negative`,
    )
    .join(". ");
  return (
    <section
      aria-labelledby="sentiment-trend-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 id="sentiment-trend-heading" class="text-lg font-semibold text-foreground">
          Sentiment Trend
        </h2>
        <div class="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Chart legend">
          <span class="flex items-center gap-2">
            <span class="size-3 rounded-sm bg-primary" aria-hidden="true" />
            Positive
          </span>
          <span class="flex items-center gap-2">
            <span
              class="size-3 rounded-sm border border-slate-400 bg-[repeating-linear-gradient(135deg,#94a3b8_0_2px,#f8fafc_2px_4px)]"
              aria-hidden="true"
            />
            Negative
          </span>
        </div>
      </div>
      <div class="mt-7 grid h-64 grid-cols-7 gap-2 sm:gap-4">
        <For each={sentimentTrend}>
          {(point) => (
            <div class="flex min-w-0 flex-col items-center">
              <button
                type="button"
                aria-label={`${point.date}: ${point.positive} positive reviews and ${point.negative} negative reviews`}
                class="group flex h-52 w-full min-w-0 items-end justify-center gap-1 rounded-md px-1 transition-colors hover:bg-muted focus:bg-muted"
              >
                <span
                  class="relative block w-3 rounded-t-sm border border-slate-400 bg-[repeating-linear-gradient(135deg,#94a3b8_0_2px,#f8fafc_2px_4px)] sm:w-4"
                  style={{ height: `${point.negative}%` }}
                  aria-hidden="true"
                />
                <span
                  class="relative block w-3 rounded-t-sm bg-primary sm:w-4"
                  style={{ height: `${point.positive}%` }}
                  aria-hidden="true"
                >
                  <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground shadow-sm group-hover:block group-focus:block">
                    {point.positive} Positive
                  </span>
                </span>
              </button>
              <span
                class={`mt-2 text-xs ${point.date === "5 Jul"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
                  }`}
              >
                {point.date}
              </span>
            </div>
          )}
        </For>
      </div>
      <p class="sr-only">Sentiment trend data. {summary}.</p>
    </section>
  );
}
```

## File: src/components/seo/ActionList.tsx
```typescript
import { For, type Component } from 'solid-js'
import ListChecks from 'lucide-solid/icons/list-checks'
import type { ActionItemData } from '../../types'
import ActionItemCard from './ActionItem'
interface ActionListProps { items: ActionItemData[] }
const ActionList: Component<ActionListProps> = (props) => {
  return (
    <div class="mt-8">
      <h3 class="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
        <div class="p-2 bg-emerald-100 rounded-lg text-emerald-600">
          <ListChecks size={20} />
        </div>
        AI-Recommended Actions
      </h3>
      <div class="space-y-4">
        <For each={props.items}>{(item) => <ActionItemCard item={item} />}</For>
      </div>
    </div>
  )
}
export default ActionList
```

## File: src/components/seo/ProgressTracker.tsx
```typescript
import type { Component } from 'solid-js'
import Sparkles from 'lucide-solid/icons/sparkles'
import type { ProgressData } from '../../types'
import { ProgressRoot, ProgressCircle, ProgressCircleTrack, ProgressCircleRange } from '../ui/progress'
const ProgressTracker: Component<ProgressData> = (props) => {
  return (
    <div class="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
      <div class="relative w-16 h-16 shrink-0">
        <ProgressRoot value={props.value} min={0} max={100}>
          <ProgressCircle>
            <ProgressCircleTrack class="stroke-slate-100" />
            <ProgressCircleRange class="stroke-emerald-600" stroke-linecap="round" />
          </ProgressCircle>
        </ProgressRoot>
        <div class="absolute inset-0 flex items-center justify-center font-bold text-slate-900">
          {props.value}%
        </div>
      </div>
      <div class="flex-1 text-center md:text-left">
        <h3 class="text-xl font-bold text-slate-900">{props.title}</h3>
        <p class="text-slate-600 mt-1 mb-4">{props.description}</p>
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
          <Sparkles size={14} />
          AI Analysis Active
        </div>
      </div>
    </div>
  )
}
export default ProgressTracker
```

## File: src/constants/index.ts
```typescript
import LayoutDashboard from 'lucide-solid/icons/layout-dashboard'
import Inbox from 'lucide-solid/icons/inbox'
import SearchCheck from 'lucide-solid/icons/search-check'
import Settings from 'lucide-solid/icons/settings'
import Bell from 'lucide-solid/icons/bell'
import HelpCircle from 'lucide-solid/icons/help-circle'
import Sparkles from 'lucide-solid/icons/sparkles'
import ListChecks from 'lucide-solid/icons/list-checks'
import ImagePlus from 'lucide-solid/icons/image-plus'
import CheckCircle2 from 'lucide-solid/icons/check-circle-2'
import MapPin from 'lucide-solid/icons/map-pin'
import BarChart3 from 'lucide-solid/icons/bar-chart-3'
import ExternalLink from 'lucide-solid/icons/external-link'
import type {
  NavItem,
  ActionItemData,
  BrandData,
  PageHeaderData,
  NavId,
} from '../types'
export const GOOGLE_PLACE_ID = "ChIJGblnVa655zsRtRfkePjHE8E"
export const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
export const ACTIVE_NAV_ID: NavId = 'dashboard'
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'reviews-inbox', label: 'Review Inbox', shortLabel: 'Inbox', icon: Inbox, href: '/reviews/inbox' },
  { id: 'reviews-new', label: 'Leave a Review', shortLabel: 'Review', icon: ExternalLink, href: '/reviews/new' },
  { id: 'marketing-seo', label: 'SEO Optimizer', shortLabel: 'SEO', icon: SearchCheck, href: '/marketing/seo' },
  { id: 'marketing-campaigns', label: 'Campaigns', shortLabel: 'Campaigns', icon: Sparkles, href: '/marketing/campaigns' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings, href: '/settings' },
]
export const BRAND: BrandData = {
  title: 'Cognitive Enterprise',
  subtitle: 'Local Management',
  icon: BarChart3,
}
export const PAGE_HEADER: PageHeaderData = {
  title: 'GMB SEO Optimizer',
  subtitle: 'AI-driven insights to improve your local search visibility.',
}
export const PROGRESS: { value: number; title: string; description: string } = {
  value: 70,
  title: 'Profile Optimization Strength',
  description:
    'Your profile is missing key information that could boost local rankings. Completing the recommended actions below will increase your visibility.',
}
export const ACTION_ITEMS: ActionItemData[] = [
  {
    id: 'add-photos',
    title: 'Add 3 new exterior photos',
    description: 'Fresh images increase engagement by 42% on local listings.',
    status: 'pending',
    icon: ImagePlus,
    actionLabel: 'Upload Photos',
    actionType: 'primary',
  },
  {
    id: 'holiday-hours',
    title: 'Update holiday operating hours',
    description: 'Completed on Nov 12, 2023.',
    status: 'completed',
    icon: CheckCircle2,
    actionLabel: 'Edit',
    actionType: 'secondary',
  },
  {
    id: 'fix-address',
    title: 'Fix inconsistent address data',
    description:
      'AI detected discrepancies between your website and local directories.',
    status: 'high-priority',
    icon: MapPin,
    actionLabel: 'Fix Now',
    actionType: 'primary',
  },
]
export const TOPBAR_ICONS = [
  { icon: Bell, label: 'Notifications' },
  { icon: HelpCircle, label: 'Help' },
] as const
export const USER_AVATAR = {
  src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvffMNkvrzOck_1yKY12efuoh8F_gTf5f8eyOqUG-UsUQy6daDvP6Ebavztpy-YtxmZ1Uj3Ta0syxUDfvlgtPGlkH7VupHVV_8bPHtaUeqGc8GXjNZeXJlasKU7EN7rpJt1iGB23X_12MBIdg6Y9eUp6KPYD73ao3L7a_hj9RaNc2QtrB6GlIy0IMILxRRqzWMcVz_Z2kNM3emo4WglpfmCOhHfsB8uakLY5_7TpCEqCIkQG7cvDxrCw',
  alt: 'User Profile Avatar',
  fallback: 'CE',
} as const
```

## File: src/features/dashboard/DashboardPage.tsx
```typescript
import { Select, createListCollection } from "@ark-ui/solid/select";
import CalendarDays from "lucide-solid/icons/calendar-days";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { createMemo, createSignal, For } from "solid-js";
import { Portal } from "solid-js/web";
import { Title } from "@solidjs/meta";
import { metrics } from "~/features/reviews/review-data";
import { MetricCard, DisabledMetricCard } from "~/components/review/metric-card";
import { ReviewSourceChart } from "~/components/review/review-source-chart";
import { SentimentTrendChart } from "~/components/review/sentiment-trend-chart";
import { QuickActions } from "~/components/dashboard/QuickActions";
import { RecentActivity } from "~/components/dashboard/RecentActivity";
import ProgressTracker from "~/components/seo/ProgressTracker";
import ActionList from "~/components/seo/ActionList";
import { PROGRESS, ACTION_ITEMS } from "~/constants";
const timePeriodItems = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];
const timePeriodCollection = createListCollection({
  items: timePeriodItems,
});
export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = createSignal(["30d"]);
  const selectedPeriodLabel = createMemo(() => {
    const selectedValue = selectedPeriod()[0];
    return (
      timePeriodItems.find((period) => period.value === selectedValue)?.label ??
      "Last 30 days"
    );
  });
  return (
    <>
      <Title>Dashboard — Cognitive Enterprise</Title>
      <div class="mx-auto max-w-7xl space-y-6 pt-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Your review performance at a glance.
            </p>
          </div>
          <Select.Root
            collection={timePeriodCollection}
            value={selectedPeriod()}
            onValueChange={(details) => setSelectedPeriod(details.value)}
            positioning={{ placement: "bottom-end" }}
            style={{ position: "relative" }}
          >
            <Select.Control>
              <Select.Trigger class="inline-flex h-10 min-w-52 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-muted">
                <span class="flex items-center gap-2">
                  <CalendarDays
                    class="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span class="hidden text-muted-foreground sm:inline">
                    Time period:
                  </span>
                  <Select.ValueText class="font-medium">
                    {selectedPeriodLabel()}
                  </Select.ValueText>
                </span>
                <ChevronDown
                  class="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content class="z-50 mt-1 min-w-52 rounded-md border border-border bg-card p-1 shadow-sm">
                  <For each={timePeriodItems}>
                    {(period) => (
                      <Select.Item
                        item={period}
                        class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-foreground outline-none data-highlighted:bg-muted"
                      >
                        <Select.ItemText>{period.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check class="size-4 text-primary" aria-hidden="true" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    )}
                  </For>
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <For each={metrics}>{(metric) => <MetricCard metric={metric} />}</For>
          <DisabledMetricCard />
        </div>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <ReviewSourceChart />
          </div>
          <QuickActions />
        </div>
        <SentimentTrendChart />
        <RecentActivity />
        <ProgressTracker
          value={PROGRESS.value}
          title={PROGRESS.title}
          description={PROGRESS.description}
        />
        <ActionList items={ACTION_ITEMS} />
      </div>
    </>
  );
}
```

## File: src/features/reviews/review-data.ts
```typescript
import Clock3 from "lucide-solid/icons/clock-3";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import Star from "lucide-solid/icons/star";
import type { LucideProps } from "lucide-solid";
import type {
  Metric,
  ReviewSource,
  ReviewSuggestion,
  TrendPoint,
} from "./review-types";
import type { Component } from "solid-js";
const reviewIcon: Component<LucideProps> = MessageSquareText;
const starIcon: Component<LucideProps> = Star;
const pendingIcon: Component<LucideProps> = Clock3;
export const metrics: Metric[] = [
  {
    label: "Total Reviews",
    value: "4,289",
    trend: "12.5%",
    trendDirection: "positive",
    icon: reviewIcon,
  },
  {
    label: "Avg Rating",
    value: "4.8",
    trend: "0.2",
    trendDirection: "positive",
    icon: starIcon,
  },
  {
    label: "Pending Replies",
    value: "124",
    trend: "5%",
    trendDirection: "negative",
    icon: pendingIcon,
  },
];
export const reviewSources: ReviewSource[] = [
  { name: "Google", percentage: 55, color: "primary" },
  { name: "Yelp", percentage: 30, color: "info" },
  { name: "Facebook", percentage: 15, color: "purple" },
];
export const initialSuggestions: ReviewSuggestion[] = [
  {
    id: "simple",
    tone: "Simple",
    text: "The meal wasn't good. It needed more heat.",
  },
  {
    id: "professional",
    tone: "Professional",
    text: "I was disappointed with the dish; it fell short of expectations and lacked the expected spice level.",
  },
];
export const sentimentTrend: TrendPoint[] = [
  { date: "1 Jul", positive: 50, negative: 25 },
  { date: "2 Jul", positive: 62, negative: 20 },
  { date: "3 Jul", positive: 55, negative: 32 },
  { date: "4 Jul", positive: 78, negative: 16 },
  { date: "5 Jul", positive: 85, negative: 25 },
  { date: "6 Jul", positive: 68, negative: 20 },
  { date: "7 Jul", positive: 54, negative: 25 },
];
```
