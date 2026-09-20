import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import {
  IconBrandGoogle,
  IconCircleCheck,
  IconFilterOff,
  IconKeyboard,
  IconMessageCircle,
  IconRefresh,
} from "@tabler/icons-solidjs";
import {
  batch,
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
import { createStore } from "solid-js/store";
import { useApp } from "~/components/app/context";
import {
  clientBusiness,
  isLoading,
  loadGoogle,
  loadGooglePage,
  settled,
} from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import { RatingPill } from "~/components/landing/brand";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  filterParams,
  filtersFrom,
  type InboxFilters,
  matchesStatus,
  readCopied,
  requestDraft,
  type StatusFilter,
  writeCopied,
} from "~/components/reviews/data";
import {
  DetailSkeleton,
  type DraftState,
  EMPTY_DRAFT,
  EmptyState,
  FilterBar,
  ListSkeleton,
  NoReviewsYet,
  panelClass,
  ReplyComposer,
  ReviewDetail,
  ReviewListbox,
  ShortcutsDialog,
} from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";
import type { GoogleReview } from "~/types/google";

const RETURN_TO = "/reviews/inbox";

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    // Ark UI widgets (selects, dialogs) own their keys.
    target.closest("[data-scope]") !== null
  );
}

export default function ReviewInboxPage() {
  const { business } = useApp();
  const [params, setParams] = useSearchParams();

  const [google, { refetch: refetchGoogle }] = createResource(
    clientBusiness(business),
    loadGoogle,
  );
  const g = () => settled(google);
  const readyData = () => {
    const data = g();
    return data?.kind === "ready" ? data : undefined;
  };

  // ── Pages beyond the first ("Load more" keeps the rows already shown)
  const [more, setMore] = createSignal<GoogleReview[]>([]);
  const [nextToken, setNextToken] = createSignal<string>();
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [moreFailed, setMoreFailed] = createSignal(false);

  createEffect(
    on(g, (data) => {
      batch(() => {
        setMore([]);
        setMoreFailed(false);
        setNextToken(data?.kind === "ready" ? data.nextPageToken : undefined);
      });
    }),
  );

  const reviews = createMemo<GoogleReview[]>(() => {
    const data = g();
    if (data?.kind !== "ready") return [];
    const byId = new Map<string, GoogleReview>();
    for (const r of [...data.reviews, ...more()]) {
      if (!byId.has(r.reviewId)) byId.set(r.reviewId, r);
    }
    return [...byId.values()];
  });

  async function loadMore() {
    const b = business.latest;
    const token = nextToken();
    if (!b || !token || loadingMore()) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const page = await loadGooglePage(b, token);
      if (page.kind !== "ready") {
        refetchGoogle();
        return;
      }
      batch(() => {
        setMore((prev) => [...prev, ...page.reviews]);
        setNextToken(page.nextPageToken);
      });
      announce(`Loaded ${page.reviews.length} more reviews`);
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Filters live in the URL
  const filters = createMemo(() => filtersFrom(params));
  const visible = createMemo(() => applyFilters(reviews(), filters()));
  const counts = createMemo<Record<StatusFilter, number>>(() => {
    const secondary = applyFilters(reviews(), { ...filters(), status: "all" });
    return {
      "needs-reply": secondary.filter((r) => matchesStatus(r, "needs-reply"))
        .length,
      replied: secondary.filter((r) => matchesStatus(r, "replied")).length,
      all: secondary.length,
    };
  });

  function setFilters(next: Partial<InboxFilters>) {
    setParams(filterParams(next), { replace: true, scroll: false });
  }

  function clearFilters() {
    setFilters({
      rating: DEFAULT_FILTERS.rating,
      sentiment: DEFAULT_FILTERS.sentiment,
      date: DEFAULT_FILTERS.date,
    });
    announce("Filters cleared");
  }

  // ── Selection (?review=id, the same link the dashboard uses)
  const selectedId = () => {
    const v = params.review;
    return Array.isArray(v) ? v[0] : v;
  };
  const selected = createMemo(() =>
    reviews().find((r) => r.reviewId === selectedId()),
  );

  const [narrow, setNarrow] = createSignal(false);
  const [openedByUser, setOpenedByUser] = createSignal(false);

  function openReview(id: string) {
    setOpenedByUser(true);
    // Pushes a history entry, so the phone's back gesture returns to the list.
    setParams({ review: id }, { scroll: narrow() });
  }

  function closeReview() {
    setParams({ review: undefined }, { scroll: false });
  }

  // ── Drafts, kept per review so switching reviews never loses text
  const [drafts, setDrafts] = createStore<Record<string, DraftState>>({});
  const draftFor = (id: string) => drafts[id] ?? EMPTY_DRAFT;

  function patchDraft(id: string, patch: Partial<DraftState>) {
    setDrafts(id, (prev) => ({ ...(prev ?? EMPTY_DRAFT), ...patch }));
  }

  async function draftReply(review: GoogleReview) {
    const id = review.reviewId;
    const current = draftFor(id);
    if (current.status === "loading") return;
    if (current.retryAt && current.retryAt > Date.now()) return;

    patchDraft(id, { status: "loading", error: undefined });
    announce("Writing a reply…");
    const result = await requestDraft(review, current.tone);

    if (result.kind === "ok") {
      patchDraft(id, {
        status: "idle",
        text: result.draft,
        aiText: result.draft,
        sentiment: result.sentiment,
      });
      announce("AI reply draft ready. Review and edit it before posting.");
    } else if (result.kind === "rate-limited") {
      patchDraft(id, {
        status: "idle",
        retryAt: result.retryAt,
        cooldownMs: result.retryAt - Date.now(),
      });
      announce("Draft limit reached. Try again later.");
    } else {
      patchDraft(id, { status: "error", error: result.message });
    }
  }

  // ── "Draft copied" marks (per browser)
  const [copied, setCopied] = createSignal<ReadonlySet<string>>(new Set());
  function markCopied(id: string) {
    const next = new Set(copied());
    next.add(id);
    setCopied(next);
    writeCopied([...next]);
  }

  // ── Live region + keyboard
  const [message, setMessage] = createSignal("");
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
  let replyBox: HTMLTextAreaElement | undefined;

  onMount(() => {
    setCopied(new Set(readCopied()));

    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if ((e.key === "r" || e.key === "R") && selected() && replyBox) {
        e.preventDefault();
        replyBox.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    onCleanup(() => {
      media.removeEventListener("change", sync);
      document.removeEventListener("keydown", onKey);
    });
  });

  // ── Derived page state
  const googleLoading = () =>
    !business.latest || isLoading(google) || google.state === "refreshing";
  // A failed business load throws from `.latest` into the page-level
  // ErrorBoundary in AppShell, so only Google can fail inside this page.
  const failed = () => google.state === "errored";
  const ready = () => Boolean(readyData());
  const hasAny = () => reviews().length > 0 || Boolean(nextToken());
  const showDetailOnly = () => narrow() && Boolean(selectedId());

  return (
    <>
      <Title>Review inbox · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-5">
        {/* Header: hidden on phones while a review is open, to give the text room */}
        <header
          class={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
            showDetailOnly() && "hidden",
          )}
        >
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-text md:text-2xl">
              Review inbox
            </h1>
            <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-text-muted">
              <Show
                when={readyData()}
                fallback="Read every review and reply within a day."
              >
                {(data) => (
                  <>
                    <Show when={data().totalReviewCount > 0}>
                      <RatingPill
                        rating={data().averageRating}
                        count={data().totalReviewCount}
                      />
                    </Show>
                    <span>
                      <span class="font-mono font-medium text-text tabular-nums">
                        {reviews().filter((r) => !r.reviewReply).length}
                      </span>{" "}
                      {nextToken() ? "of the loaded reviews need" : "need"} a
                      reply
                    </span>
                  </>
                )}
              </Show>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            class={cn(
              btnSecondary,
              "hidden shrink-0 px-3 text-sm lg:inline-flex",
            )}
          >
            <IconKeyboard aria-hidden="true" class="size-4" />
            Shortcuts
          </button>
        </header>

        <Switch>
          {/* Google not connected, or its token expired */}
          <Match when={g()?.kind === "disconnected"}>
            <Notice tone="warning">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>Reconnect Google to load your reviews.</span>
                <a
                  href={`/api/google/auth?returnTo=${encodeURIComponent(RETURN_TO)}`}
                  class={cn(btnPrimary, "min-h-9 px-3 text-sm")}
                >
                  <IconBrandGoogle aria-hidden="true" class="size-4" />
                  Reconnect
                </a>
              </div>
            </Notice>
            <div class={panelClass}>
              <EmptyState
                icon={IconBrandGoogle}
                title="Your inbox is waiting on Google"
              >
                Flonion reads reviews from your Google Business Profile. Once
                it's connected, every review shows up here with a one-tap reply
                draft.
              </EmptyState>
            </div>
          </Match>

          <Match when={g()?.kind === "unmatched"}>
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

          <Match when={failed()}>
            <div class={cn(panelClass, "p-4 md:p-5")}>
              <WidgetError
                what="your reviews"
                onRetry={() => refetchGoogle()}
              />
            </div>
          </Match>

          <Match when={!googleLoading() && ready() && !hasAny()}>
            <div class={panelClass}>
              <NoReviewsYet />
            </div>
          </Match>

          <Match when={true}>
            <div class={cn(showDetailOnly() && "hidden")}>
              <FilterBar
                filters={filters()}
                counts={counts()}
                activeCount={activeFilterCount(filters())}
                onChange={setFilters}
                onClear={clearFilters}
              />
            </div>

            <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
              {/* List */}
              <section
                aria-label="Review list"
                class={cn(
                  panelClass,
                  "overflow-hidden lg:col-span-5",
                  showDetailOnly() && "hidden",
                )}
              >
                <Switch>
                  <Match when={googleLoading()}>
                    <ListSkeleton rows={5} />
                  </Match>

                  <Match when={visible().length === 0}>
                    <Show
                      when={
                        filters().status === "needs-reply" &&
                        activeFilterCount(filters()) === 0
                      }
                      fallback={
                        <EmptyState
                          icon={IconFilterOff}
                          title="No reviews match these filters"
                          action={
                            <button
                              type="button"
                              onClick={() =>
                                activeFilterCount(filters())
                                  ? clearFilters()
                                  : setFilters({ status: "all" })
                              }
                              class={btnSecondary}
                            >
                              {activeFilterCount(filters())
                                ? "Clear filters"
                                : "Show all reviews"}
                            </button>
                          }
                        >
                          <Show when={nextToken()}>
                            Only loaded reviews are searched. Load more to look
                            further back.
                          </Show>
                        </EmptyState>
                      }
                    >
                      <EmptyState
                        icon={IconCircleCheck}
                        title="All caught up"
                        action={
                          <button
                            type="button"
                            onClick={() => setFilters({ status: "all" })}
                            class={btnSecondary}
                          >
                            View all reviews
                          </button>
                        }
                      >
                        Every loaded review has a reply on Google.
                      </EmptyState>
                    </Show>
                  </Match>

                  <Match when={true}>
                    <ReviewListbox
                      reviews={visible()}
                      selectedId={selectedId()}
                      copied={copied()}
                      onOpen={openReview}
                    />
                  </Match>
                </Switch>

                <Show when={!googleLoading() && ready()}>
                  <div class="flex flex-col items-center gap-2 border-t border-border px-4 py-3 text-center">
                    <p class="text-xs text-text-muted">
                      Showing{" "}
                      <span class="font-mono tabular-nums">
                        {visible().length}
                      </span>{" "}
                      of{" "}
                      <span class="font-mono tabular-nums">
                        {reviews().length}
                      </span>{" "}
                      loaded
                      <Show
                        when={
                          (readyData()?.totalReviewCount ?? 0) >
                          reviews().length
                        }
                      >
                        {" "}
                        ·{" "}
                        <span class="font-mono tabular-nums">
                          {readyData()?.totalReviewCount}
                        </span>{" "}
                        on Google
                      </Show>
                    </p>
                    <Show when={moreFailed()}>
                      <Notice tone="error" class="w-full text-left">
                        We couldn't load more reviews. Try again.
                      </Notice>
                    </Show>
                    <Show when={nextToken()}>
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore()}
                        class={cn(
                          btnSecondary,
                          "w-full text-sm disabled:cursor-progress disabled:opacity-80",
                        )}
                      >
                        <Show
                          when={loadingMore()}
                          fallback={
                            <IconRefresh aria-hidden="true" class="size-4" />
                          }
                        >
                          <Spinner class="size-4" />
                        </Show>
                        {loadingMore() ? "Loading…" : "Load more reviews"}
                      </button>
                    </Show>
                  </div>
                </Show>
              </section>

              {/* Detail + reply */}
              <section
                aria-label="Selected review"
                class={cn(
                  panelClass,
                  "lg:sticky lg:top-24 lg:col-span-7 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto",
                  narrow() && !selectedId() && "hidden",
                )}
              >
                <Switch>
                  <Match when={googleLoading()}>
                    <DetailSkeleton />
                  </Match>

                  <Match when={selected()}>
                    {(review) => (
                      <Show when={review().reviewId} keyed>
                        {(id) => (
                          <ReviewDetail
                            review={review()}
                            analysis={draftFor(id).sentiment}
                            showBack={narrow()}
                            focusHeading={narrow() && openedByUser()}
                            onBack={closeReview}
                          >
                            <ReplyComposer
                              review={review()}
                              state={draftFor(id)}
                              textareaRef={(el) => {
                                replyBox = el;
                              }}
                              onTone={(tone) => patchDraft(id, { tone })}
                              onText={(text) => patchDraft(id, { text })}
                              onDraft={() => draftReply(review())}
                              onCopied={() => markCopied(id)}
                              announce={announce}
                            />
                          </ReviewDetail>
                        )}
                      </Show>
                    )}
                  </Match>

                  <Match when={selectedId()}>
                    <EmptyState
                      icon={IconMessageCircle}
                      title="We couldn't find that review"
                      action={
                        <>
                          <Show when={nextToken()}>
                            <button
                              type="button"
                              onClick={loadMore}
                              disabled={loadingMore()}
                              class={btnSecondary}
                            >
                              Load more reviews
                            </button>
                          </Show>
                          <button
                            type="button"
                            onClick={closeReview}
                            class={btnSecondary}
                          >
                            Back to the list
                          </button>
                        </>
                      }
                    >
                      It may be older than the reviews loaded so far, or it was
                      removed on Google.
                    </EmptyState>
                  </Match>

                  <Match when={true}>
                    <EmptyState
                      icon={IconMessageCircle}
                      title="Pick a review to reply"
                    >
                      Choose a review from the list to read it in full and draft
                      a reply. Use ↑ and ↓ to move, Enter to open.
                    </EmptyState>
                  </Match>
                </Switch>
              </section>
            </div>
          </Match>
        </Switch>
      </div>

      <ShortcutsDialog
        open={shortcutsOpen()}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
