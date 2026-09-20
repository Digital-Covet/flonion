import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { IconBrandGoogle, IconPlus } from "@tabler/icons-solidjs";
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
import { useApp } from "~/components/app/context";
import {
  clientBusiness,
  isLoading,
  loadAnalytics,
  loadGoogle,
  loadMeetings,
  loadTasks,
  profileChecks,
  settled,
} from "~/components/dashboard/data";
import {
  monthlyTrend,
  RatingTrendChart,
} from "~/components/dashboard/RatingTrend";
import {
  Skeleton,
  SkeletonRows,
  Widget,
  WidgetError,
} from "~/components/dashboard/ui";
import {
  AllCaughtUp,
  dueTasks,
  KpiStrip,
  MeetingList,
  ProfileScore,
  ReviewList,
  SetupChecklist,
  setupSteps,
  TaskList,
  UpcomingEmpty,
  unrepliedReviews,
  upcomingMeetings,
} from "~/components/dashboard/widgets";
import { btnPrimary, Notice } from "~/components/onboarding/ui";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";

const FOCUS_REFRESH_MS = 60_000;

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { business, refetchBusiness } = useApp();
  const session = authClient.useSession();

  // Every widget loads after mount and independently: one slow source
  // (usually Google) never blocks the rest of the page.
  const [ready, setReady] = createSignal(false);
  const [greeting, setGreeting] = createSignal("Welcome back");
  const [isMobile, setIsMobile] = createSignal(false);

  const [google, { refetch: refetchGoogle }] = createResource(
    clientBusiness(business),
    loadGoogle,
  );
  const [analytics, { refetch: refetchAnalytics }] = createResource(
    ready,
    loadAnalytics,
  );
  const [tasks, { refetch: refetchTasks }] = createResource(ready, loadTasks);
  const [meetings, { refetch: refetchMeetings }] = createResource(
    ready,
    loadMeetings,
  );

  onMount(() => {
    setReady(true);
    setGreeting(greetingFor(new Date()));

    const media = window.matchMedia("(max-width: 767px)");
    const syncMobile = () => setIsMobile(media.matches);
    syncMobile();
    media.addEventListener("change", syncMobile);

    // No polling: refresh when the owner comes back to the tab.
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      refetchBusiness();
      refetchAnalytics();
      refetchTasks();
      refetchMeetings();
    };
    document.addEventListener("visibilitychange", onFocus);
    onCleanup(() => {
      media.removeEventListener("change", syncMobile);
      document.removeEventListener("visibilitychange", onFocus);
    });
  });

  const b = () => business.latest;
  const g = () => settled(google);
  const a = () => settled(analytics);

  const firstName = () => session().data?.user.name?.split(" ")[0];
  const unreplied = createMemo(() => unrepliedReviews(g()));
  const googleReady = () => g()?.kind === "ready";
  const hasReviews = () => {
    const data = g();
    return data?.kind === "ready" && data.reviews.length > 0;
  };
  const loadedReviews = () => {
    const data = g();
    return data?.kind === "ready" ? data.reviews.length : 0;
  };
  const trend = createMemo(() => {
    const data = g();
    return data?.kind === "ready"
      ? monthlyTrend(data.reviews, isMobile() ? 3 : 6)
      : [];
  });

  return (
    <>
      <Title>Dashboard · Flonion</Title>

      <div class="flex flex-col gap-6">
        {/* Page header */}
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              {greeting()}
              <Show when={firstName()}>{(n) => <>, {n()}</>}</Show>
            </h1>
            <Show when={b()} fallback={<Skeleton class="mt-2 h-5 w-48" />}>
              {(info) => (
                <p class="mt-1 text-base text-text-muted">
                  Here's how{" "}
                  <span class="font-medium text-text">
                    {info().businessName || "your business"}
                  </span>{" "}
                  is doing today.
                </p>
              )}
            </Show>
          </div>
          <A
            href="/reviews/new"
            class={cn(btnPrimary, "shrink-0 self-start sm:self-auto")}
          >
            <IconPlus aria-hidden="true" class="size-5" />
            New review request
          </A>
        </header>

        <Show when={g()?.kind === "unmatched"}>
          <Notice tone="warning">
            Google is connected, but none of its locations match this business.
            Check the Google listing selected in{" "}
            <A
              href="/settings"
              class="font-medium underline underline-offset-4"
            >
              Settings
            </A>
            .
          </Notice>
        </Show>

        <KpiStrip
          business={b()}
          google={g()}
          googleFailed={google.state === "errored"}
          analytics={a()}
          analyticsFailed={analytics.state === "errored"}
        />

        {/* Mobile order: Needs attention → Profile score → Upcoming → Trend */}
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Widget
            id="needs-attention"
            title={hasReviews() ? "Needs attention" : "Get started"}
            meta={
              <Show when={hasReviews() && unreplied().length}>
                <span class="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs font-medium text-primary tabular-nums">
                  {unreplied().length}
                  <span class="sr-only"> reviews without a reply</span>
                </span>
              </Show>
            }
            action={
              hasReviews()
                ? { href: "/reviews/inbox", label: "Open inbox" }
                : undefined
            }
            class="lg:col-span-8"
          >
            <Switch>
              <Match when={google.state === "errored"}>
                <WidgetError
                  what="your Google reviews"
                  onRetry={refetchGoogle}
                />
              </Match>
              <Match when={!b() || isLoading(google) || isLoading(analytics)}>
                <SkeletonRows rows={3} label="reviews" />
              </Match>
              <Match when={hasReviews() && unreplied().length === 0}>
                <AllCaughtUp />
              </Match>
              <Match when={hasReviews()}>
                <ReviewList reviews={unreplied().slice(0, 5)} />
              </Match>
              <Match when={b()}>
                {(info) => (
                  <SetupChecklist steps={setupSteps(info(), g(), a())} />
                )}
              </Match>
            </Switch>
          </Widget>

          <Widget
            id="profile-score"
            title="Profile score"
            action={{ href: "/marketing/seo", label: "Local SEO" }}
            class="lg:col-span-4"
          >
            <Switch>
              <Match when={b() && !isLoading(google) ? b() : undefined}>
                {(info) => (
                  <ProfileScore
                    checks={profileChecks(
                      info(),
                      g() !== undefined && g()?.kind !== "disconnected",
                    )}
                  />
                )}
              </Match>
              <Match when={true}>
                <div aria-busy="true" class="flex flex-col items-center gap-4">
                  <span class="sr-only">Loading profile score…</span>
                  <Skeleton class="h-24 w-44 rounded-t-full" />
                  <Skeleton class="h-11 w-full" />
                  <Skeleton class="h-11 w-full" />
                  <Skeleton class="h-11 w-full" />
                </div>
              </Match>
            </Switch>
          </Widget>

          <Widget
            id="rating-trend"
            title="Rating trend"
            meta={
              <Show when={googleReady()}>
                <span class="text-sm text-text-muted">
                  Last {isMobile() ? "3" : "6"} months
                </span>
              </Show>
            }
            class="order-last lg:order-none lg:col-span-8"
          >
            <Switch>
              <Match when={google.state === "errored"}>
                <WidgetError what="your rating trend" onRetry={refetchGoogle} />
              </Match>
              <Match when={!b() || isLoading(google)}>
                <div aria-busy="true">
                  <span class="sr-only">Loading rating trend…</span>
                  <Skeleton class="h-[267px] w-full" />
                </div>
              </Match>
              <Match when={hasReviews()}>
                <RatingTrendChart points={trend()} />
                <p class="mt-2 text-xs text-text-muted">
                  Based on your latest{" "}
                  <span class="font-mono tabular-nums">{loadedReviews()}</span>{" "}
                  Google reviews.
                </p>
              </Match>
              <Match when={true}>
                <div class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <IconBrandGoogle
                    aria-hidden="true"
                    class="size-8 text-text-muted"
                  />
                  <p class="max-w-[40ch] text-sm text-text-muted">
                    {g()?.kind === "disconnected"
                      ? "Connect Google to track how your rating changes month to month."
                      : "Your trend appears once your first Google reviews come in."}
                  </p>
                </div>
              </Match>
            </Switch>
          </Widget>

          <Widget id="upcoming" title="Upcoming" class="lg:col-span-4">
            <div class="flex flex-col gap-5">
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <h3 class="text-sm font-medium text-text-muted">Meetings</h3>
                  <A
                    href="/collaborations/meeting-schedular"
                    class="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Calendar
                  </A>
                </div>
                <Switch>
                  <Match when={meetings.state === "errored"}>
                    <WidgetError what="meetings" onRetry={refetchMeetings} />
                  </Match>
                  <Match when={isLoading(meetings)}>
                    <SkeletonRows rows={2} label="meetings" />
                  </Match>
                  <Match
                    when={(() => {
                      const list = upcomingMeetings(settled(meetings) ?? []);
                      return list.length ? list : undefined;
                    })()}
                  >
                    {(list) => <MeetingList meetings={list()} />}
                  </Match>
                  <Match when={true}>
                    <UpcomingEmpty>No meetings coming up.</UpcomingEmpty>
                  </Match>
                </Switch>
              </div>

              <div class="border-t border-border pt-4">
                <div class="mb-1 flex items-center justify-between">
                  <h3 class="text-sm font-medium text-text-muted">
                    Tasks due today
                  </h3>
                  <A
                    href="/collaborations/tasks"
                    class="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Task board
                  </A>
                </div>
                <Switch>
                  <Match when={tasks.state === "errored"}>
                    <WidgetError what="tasks" onRetry={refetchTasks} />
                  </Match>
                  <Match when={isLoading(tasks)}>
                    <SkeletonRows rows={2} label="tasks" />
                  </Match>
                  <Match
                    when={(() => {
                      const list = dueTasks(settled(tasks) ?? []);
                      return list.length ? list : undefined;
                    })()}
                  >
                    {(list) => <TaskList tasks={list()} />}
                  </Match>
                  <Match when={true}>
                    <UpcomingEmpty>Nothing due today.</UpcomingEmpty>
                  </Match>
                </Switch>
              </div>
            </div>
          </Widget>
        </div>
      </div>
    </>
  );
}
