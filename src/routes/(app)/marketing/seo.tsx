import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { IconBrandGoogle, IconSettings } from "@tabler/icons-solidjs";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useApp } from "~/components/app/context";
import {
  clientBusiness,
  isLoading,
  loadGoogle,
  loadListing,
  settled,
} from "~/components/dashboard/data";
import { SkeletonRows, Widget, WidgetError } from "~/components/dashboard/ui";
import { btnPrimarySm, btnSecondary, Notice } from "~/components/onboarding/ui";
import { splitKeywords } from "~/components/reviews/composer";
import {
  categories,
  GOOGLE_PROFILE_URL,
  keywordRows,
  listingRows,
  overallScore,
  phrasesFromReviews,
  readTicked,
  reviewSignals,
  seoActions,
  writeTicked,
} from "~/components/seo/data";
import {
  ActionList,
  KeywordsPanel,
  ListingPanel,
  ListingSkeleton,
  ScoreCard,
  ScoreSkeleton,
  SignalsSkeleton,
  SignalsStrip,
} from "~/components/seo/widgets";

const RETURN_TO = "/marketing/seo";
const FOCUS_REFRESH_MS = 60_000;

export default function LocalSeoPage() {
  const { business, refetchBusiness } = useApp();

  // Reviews and the listing load independently: one slow Google call never
  // blocks the other, and the profile part of the page works without Google.
  const [google, { refetch: refetchGoogle }] = createResource(
    clientBusiness(business),
    loadGoogle,
  );
  const [listing, { refetch: refetchListing }] = createResource(
    clientBusiness(business),
    loadListing,
  );

  const b = () => business.latest;
  const g = () => settled(google);
  const l = () => settled(listing);
  const readyGoogle = () => {
    const data = g();
    return data?.kind === "ready" ? data : undefined;
  };

  // ── Manual ticks for steps done on Google
  const [ticked, setTicked] = createSignal<ReadonlySet<string>>(new Set());
  const [message, setMessage] = createSignal("");

  onMount(() => {
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      refetchBusiness();
    };
    document.addEventListener("visibilitychange", onFocus);
    onCleanup(() => document.removeEventListener("visibilitychange", onFocus));
  });

  createEffect(
    on(
      () => b()?.businessId,
      (id) => {
        if (id) setTicked(new Set(readTicked(id)));
      },
    ),
  );

  function toggle(id: string, done: boolean) {
    const businessId = b()?.businessId;
    if (!businessId) return;
    const next = new Set(ticked());
    if (done) next.add(id);
    else next.delete(id);
    setTicked(next);
    writeTicked(businessId, [...next]);
    setMessage("");
    queueMicrotask(() =>
      setMessage(done ? "Marked as done" : "Marked as not done"),
    );
  }

  // ── Derived
  const googleSettled = () => !isLoading(google) && !isLoading(listing);
  const scoreReady = () => Boolean(b()) && googleSettled();

  const cats = createMemo(() => {
    const info = b();
    if (!info) return [];
    return categories({ business: info, google: g(), listing: l() });
  });
  const score = () => overallScore(cats());
  const unscored = () => cats().filter((c) => c.score === null).length;

  const actions = createMemo(() => {
    const info = b();
    if (!info) return [];
    return seoActions({
      business: info,
      google: g(),
      listing: l(),
      ticked: ticked(),
    });
  });
  const openHigh = () =>
    actions().filter((a) => !a.done && a.impact === "high").length;

  const signals = createMemo(() => {
    const data = readyGoogle();
    return data ? reviewSignals(data) : undefined;
  });

  const keywords = createMemo(() => {
    const info = b();
    return info ? keywordRows(info, readyGoogle()?.reviews ?? []) : [];
  });
  const phrases = createMemo(() => {
    const info = b();
    const data = readyGoogle();
    return info && data
      ? phrasesFromReviews(data.reviews, splitKeywords(info.keywords))
      : [];
  });

  const listingData = createMemo(() => {
    const info = b();
    const data = l();
    return info && data?.kind === "ready"
      ? listingRows(info, data.location)
      : undefined;
  });

  const disconnected = () =>
    g()?.kind === "disconnected" || l()?.kind === "disconnected";
  const unmatched = () =>
    !disconnected() && (g()?.kind === "unmatched" || l()?.kind === "unmatched");

  return (
    <>
      <Title>Local SEO · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Local SEO
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              How easy it is for nearby customers to find{" "}
              <span class="font-medium text-text">
                {b()?.businessName || "your business"}
              </span>{" "}
              on Google, and what to fix first.
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <a
              href={GOOGLE_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              class={btnSecondary}
            >
              <IconBrandGoogle aria-hidden="true" class="size-5" />
              Google profile
              <span class="sr-only"> (opens in a new tab)</span>
            </a>
            <A href="/settings" class={btnSecondary}>
              <IconSettings aria-hidden="true" class="size-5" />
              Edit profile
            </A>
          </div>
        </header>

        <Switch>
          <Match when={disconnected()}>
            <Notice
              tone="warning"
              action={
                <a
                  href={`/api/google/auth?returnTo=${encodeURIComponent(RETURN_TO)}`}
                  class={btnPrimarySm}
                >
                  <IconBrandGoogle aria-hidden="true" class="size-4" />
                  Connect Google
                </a>
              }
            >
              Connect Google to score your reviews, replies and listing. Until
              then, the score covers your profile and keywords only.
            </Notice>
          </Match>
          <Match when={unmatched()}>
            <Notice tone="warning">
              Google is connected, but none of its locations match this
              business. Check the Google listing selected in{" "}
              <A
                href="/settings"
                class="font-medium underline underline-offset-4"
              >
                Settings
              </A>
              .
            </Notice>
          </Match>
        </Switch>

        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <Widget
            id="seo-score"
            title="Local SEO score"
            class="lg:col-span-5"
            meta={
              <Show when={scoreReady() && unscored()}>
                <span class="text-sm text-text-muted">
                  {cats().length - unscored()} of {cats().length} parts scored
                </span>
              </Show>
            }
          >
            <Switch>
              <Match when={!scoreReady()}>
                <ScoreSkeleton />
              </Match>
              <Match when={true}>
                <ScoreCard score={score()} categories={cats()} />
                <p class="mt-5 text-xs text-pretty text-text-muted">
                  Flonion's own estimate from your profile and Google data.
                  Google doesn't publish a ranking score.
                </p>
              </Match>
            </Switch>
          </Widget>

          <Widget
            id="seo-actions"
            title="What to fix first"
            class="lg:col-span-7"
            meta={
              <Show when={scoreReady() && openHigh()}>
                <span class="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs font-medium text-primary tabular-nums">
                  {openHigh()}
                  <span class="sr-only"> high-impact steps left</span>
                </span>
              </Show>
            }
          >
            <Switch>
              <Match when={!scoreReady()}>
                <SkeletonRows rows={5} label="actions" />
              </Match>
              <Match when={true}>
                <ActionList actions={actions()} onToggle={toggle} />
              </Match>
            </Switch>
          </Widget>
        </div>

        <section aria-labelledby="seo-signals" class="flex flex-col gap-3">
          <h2
            id="seo-signals"
            class="font-display text-lg font-semibold text-text"
          >
            Review signals
          </h2>
          <Switch>
            <Match when={google.state === "errored"}>
              <div class="rounded-lg border border-border bg-surface p-4">
                <WidgetError
                  what="your Google reviews"
                  onRetry={refetchGoogle}
                />
              </div>
            </Match>
            <Match when={!b() || isLoading(google)}>
              <SignalsSkeleton />
            </Match>
            <Match when={signals()}>
              {(s) => <SignalsStrip signals={s()} />}
            </Match>
            <Match when={true}>
              <p class="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-text-muted">
                Rating, review pace and reply times appear here once Google is
                connected to this business.
              </p>
            </Match>
          </Switch>
        </section>

        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <Widget
            id="seo-keywords"
            title="Keywords"
            action={{ href: "/settings", label: "Edit keywords" }}
            class="lg:col-span-7"
          >
            <Switch>
              <Match when={!b() || isLoading(google)}>
                <SkeletonRows rows={4} label="keywords" />
              </Match>
              <Match when={true}>
                <KeywordsPanel
                  rows={keywords()}
                  phrases={phrases()}
                  reviewsLoaded={
                    readyGoogle() ? (readyGoogle()?.reviews.length ?? 0) : null
                  }
                />
              </Match>
            </Switch>
          </Widget>

          <Widget
            id="seo-listing"
            title="Google listing match"
            class="lg:col-span-5"
          >
            <Switch>
              <Match when={listing.state === "errored"}>
                <WidgetError
                  what="your Google listing"
                  onRetry={refetchListing}
                />
              </Match>
              <Match when={!b() || isLoading(listing)}>
                <ListingSkeleton />
              </Match>
              <Match when={listingData()}>
                {(rows) => (
                  <>
                    <p class="mb-4 text-sm text-pretty text-text-muted">
                      Google trusts a listing more when its name, address and
                      phone match everywhere they appear.
                    </p>
                    <ListingPanel rows={rows()} />
                  </>
                )}
              </Match>
              <Match when={true}>
                <div class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <IconBrandGoogle
                    aria-hidden="true"
                    class="size-8 text-text-muted"
                  />
                  <p class="max-w-[40ch] text-sm text-text-muted">
                    {l()?.kind === "unmatched"
                      ? "Pick the matching Google listing in Settings to compare it with your profile."
                      : "Connect Google to check that your name, address and phone match your listing."}
                  </p>
                </div>
              </Match>
            </Switch>
          </Widget>
        </div>
      </div>
    </>
  );
}
