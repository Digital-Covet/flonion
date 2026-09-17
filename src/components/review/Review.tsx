import { Title } from "@solidjs/meta";
import { useLocation, useSearchParams } from "@solidjs/router";
import CalendarDays from "lucide-solid/icons/calendar-days";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import Search from "lucide-solid/icons/search";
import Send from "lucide-solid/icons/send";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { SentimentBadge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { SkeletonRows, WidgetError } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import type { Review } from "~/types";
import { type GoogleReview, googleStarRatingToNumber } from "~/types/google";

type FilterValue = "all" | "needs-reply" | "google";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs-reply", label: "Needs Reply" },
  { value: "google", label: "Google" },
];

function mapGoogleReviewToReview(googleReview: GoogleReview): Review {
  const name = googleReview.reviewer.displayName || "Anonymous";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const rating = googleStarRatingToNumber(googleReview.starRating);
  const hasReply = !!googleReview.reviewReply;

  const timeDiff = Date.now() - new Date(googleReview.updateTime).getTime();
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  let ago: string;
  if (days === 0) ago = "Today";
  else if (days === 1) ago = "Yesterday";
  else if (days < 7) ago = `${days} days ago`;
  else if (days < 30) ago = `${Math.floor(days / 7)} weeks ago`;
  else if (days < 365) ago = `${Math.floor(days / 30)} months ago`;
  else ago = `${Math.floor(days / 365)} years ago`;

  return {
    id: googleReview.reviewId,
    name,
    initials,
    ago,
    source: "Google",
    rating,
    preview: googleReview.comment || "(No review text)",
    fullReview: googleReview.comment || "(No review text)",
    draftReady: !hasReply,
    avatarTone: rating <= 2 ? "destructive" : "primary",
    reviewId: googleReview.reviewId,
    hasReply,
  };
}

/**
 * Whether the owner's Google account is linked -- a question about the stored
 * grant, deliberately independent of whether the Business Profile API is
 * currently answering. Inferring it from a reviews/locations fetch meant a
 * quota error rendered as "not connected" and prompted a pointless reconnect.
 */
async function fetchConnected(): Promise<boolean> {
  if (isServer) return false;
  try {
    const res = await fetch("/api/google/status");
    if (!res.ok) return false;
    const { connected } = await res.json();
    return Boolean(connected);
  } catch {
    return false;
  }
}

async function fetchReviews(): Promise<{
  reviews: Review[];
  connected: boolean;
}> {
  if (isServer) return { reviews: [], connected: false };

  const connected = await fetchConnected();

  try {
    const locationsRes = await fetch("/api/google/locations");
    if (locationsRes.status === 401) return { reviews: [], connected: false };

    const locationsData = await locationsRes.json();
    if (locationsData.error) return { reviews: [], connected };

    const allReviews: Review[] = [];

    for (const account of locationsData.accounts || []) {
      for (const location of account.locations || []) {
        const accountId = account.name.replace("accounts/", "");
        const locationId = location.name.replace("locations/", "");

        const reviewsRes = await fetch(
          `/api/google/reviews?accountId=${accountId}&locationId=${locationId}`,
        );
        if (!reviewsRes.ok) continue;

        const reviewsData = await reviewsRes.json();
        for (const review of reviewsData.reviews || []) {
          allReviews.push(mapGoogleReviewToReview(review));
        }
      }
    }

    return { reviews: allReviews, connected };
  } catch {
    return { reviews: [], connected };
  }
}

function RatingStars(props: { rating: number; pill?: boolean; size?: number }) {
  const stars = [0, 1, 2, 3, 4];
  const size = props.size ?? 16;

  return (
    <div
      classList={{
        "flex items-center text-star": true,
        "rounded-full bg-star/10 px-3 py-1": !!props.pill,
      }}
      role="img"
      aria-label={`${props.rating} out of 5 stars`}
    >
      <For each={stars}>
        {(star) => (
          <Star
            size={size}
            class={star < props.rating ? "fill-current" : ""}
            stroke-width={1.8}
          />
        )}
      </For>
    </div>
  );
}

function FilterButton(props: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onSelect}
      classList={{
        "whitespace-nowrap rounded-full px-3 py-1 text-sm transition-opacity duration-[180ms] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary": true,
        "bg-muted text-foreground": props.selected,
        "border border-border bg-card text-muted-foreground hover:bg-muted":
          !props.selected,
      }}
    >
      {props.label}
    </button>
  );
}

function InitialsAvatar(props: {
  initials: string;
  tone: "primary" | "destructive";
  size?: "sm" | "md";
}) {
  const sizeClass =
    props.size === "md" ? "h-12 w-12 font-heading text-xl" : "h-8 w-8 text-base";
  const toneClass =
    props.tone === "destructive"
      ? "bg-destructive-soft text-destructive"
      : "bg-primary-soft text-primary-soft-foreground";

  return (
    <div
      class={`inline-flex items-center justify-center rounded-full font-medium ${sizeClass} ${toneClass}`}
      aria-hidden="true"
    >
      {props.initials}
    </div>
  );
}

function ReviewListItem(props: {
  review: Review;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      aria-current={props.active ? "true" : undefined}
      classList={{
        "e1-enter group relative w-full overflow-hidden rounded-card border p-4 text-left transition-shadow": true,
        "border-primary bg-card shadow-sm": props.active,
        "border-border bg-card hover:shadow-sm": !props.active,
      }}
    >
      <div class="mb-2 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <InitialsAvatar
            initials={props.review.initials}
            tone={props.review.avatarTone}
          />
          <div class="min-w-0">
            <h3 class="truncate text-base font-medium text-foreground">
              {props.review.name}
            </h3>
            <p class="text-sm text-muted-foreground">
              {props.review.ago} via {props.review.source}
            </p>
          </div>
        </div>
        <RatingStars rating={props.review.rating} />
      </div>

      <p class="line-clamp-2 text-sm text-muted-foreground">
        {props.review.preview}
      </p>

      <Show when={props.review.draftReady}>
        <div class="mt-3 flex items-center gap-1 text-primary">
          <Sparkles size={14} />
          <span class="text-sm font-medium">Draft Ready</span>
        </div>
      </Show>
    </button>
  );
}

type ReplyTone = "professional" | "friendly" | "formal";

const TONES: { value: ReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
];

export default function ReviewInbox() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReviewId, setSelectedReviewId] = createSignal<string>("");
  const [trigger, setTrigger] = createSignal(0);
  const [isConnected, setIsConnected] = createSignal(false);
  // Reviews marked replied in this session (Publish is local until the
  // platform API confirms; treated as replied for filter purposes).
  const [repliedIds, setRepliedIds] = createSignal<Set<string>>(new Set());

  // AI reply drafter state — the editor text is never cleared on failure.
  const [tone, setTone] = createSignal<ReplyTone>("professional");
  const [replyText, setReplyText] = createSignal("");
  const [replyStatus, setReplyStatus] = createSignal<
    "idle" | "pending" | "ready" | "error"
  >("idle");
  const [replyError, setReplyError] = createSignal("");
  const [replyAnnouncement, setReplyAnnouncement] = createSignal("");

  const [reviews] = createResource(trigger, async () => {
    const result = await fetchReviews();
    setIsConnected(result.connected);
    return result.reviews;
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      // Drop only the OAuth hand-off param; keep shareable filter params.
      params.delete("connected");
      const rest = params.toString();
      window.history.replaceState(
        {},
        "",
        rest ? `/reviews/inbox?${rest}` : "/reviews/inbox",
      );
      setTrigger((t) => t + 1);
    }
  });

  // Filters are URL-encoded for shareability: ?filter=needs-reply&q=...
  const activeFilter = (): FilterValue => {
    const f = searchParams.filter;
    return f === "needs-reply" || f === "google" ? f : "all";
  };
  const query = () => (searchParams.q ?? "").toString().toLowerCase();

  const setFilter = (value: FilterValue) => {
    setSearchParams({ filter: value === "all" ? undefined : value });
  };

  const withReplyState = (list: Review[]): Review[] =>
    list.map((r) =>
      repliedIds().has(r.id) && !r.hasReply
        ? { ...r, hasReply: true, draftReady: false }
        : r,
    );

  const counts = createMemo(() => {
    const list = withReplyState(reviews() ?? []);
    return {
      all: list.length,
      needsReply: list.filter((r) => !r.hasReply).length,
      google: list.filter((r) => r.source === "Google").length,
    };
  });

  const filteredReviews = createMemo(() => {
    const q = query();
    return withReplyState(reviews() ?? []).filter((r) => {
      if (activeFilter() === "needs-reply" && r.hasReply) return false;
      if (activeFilter() === "google" && r.source !== "Google") return false;
      if (q && !`${r.name} ${r.preview}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  });

  // Select the first row once data lands so the detail pane is never blank
  // while results exist; keep the user's pick afterwards.
  createEffect(() => {
    const list = filteredReviews();
    if (list.length > 0 && !list.some((r) => r.id === selectedReviewId())) {
      setSelectedReviewId(list[0].id);
    }
  });

  const selectedReview = createMemo(() => {
    const list = filteredReviews();
    return list.find((r) => r.id === selectedReviewId()) ?? list[0];
  });

  const sentimentOf = (rating: number): "positive" | "neutral" | "negative" =>
    rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative";

  // A new selection starts a fresh draft; a kept editor belongs to its review.
  createEffect(() => {
    selectedReviewId();
    setReplyText("");
    setReplyStatus("idle");
    setReplyError("");
  });

  const generateReply = async () => {
    const review = selectedReview();
    if (!review || replyStatus() === "pending") return;
    setReplyStatus("pending");
    setReplyError("");
    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: review.fullReview ?? review.preview,
          starRating: review.rating,
          reviewerName: review.name,
          tone: tone(),
        }),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        const secs =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
        throw new Error(`AI limit reached. Try again in ${secs}s.`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Could not generate a reply.");
      }
      const data = await res.json();
      setReplyText(data.draftReply ?? "");
      setReplyStatus("ready");
      setReplyAnnouncement("Reply ready.");
      notify("success", "Reply ready");
    } catch (err) {
      // Editor text is preserved — Retry reuses it as context.
      setReplyStatus("error");
      setReplyError(
        err instanceof Error ? err.message : "Could not generate a reply.",
      );
    }
  };

  const publishReply = () => {
    const review = selectedReview();
    if (!review || !replyText().trim()) return;
    setRepliedIds((prev) => new Set(prev).add(review.id));
    setReplyStatus("idle");
    notify("success", "Reply saved");
  };

  const isLoading = createMemo(() => reviews.state === "pending");
  const hasError = createMemo(() => reviews.state === "errored");
  const isEmpty = createMemo(
    () => reviews.state === "ready" && (reviews() ?? []).length === 0,
  );

  return (
    <div class="flex h-full min-w-0 flex-1 flex-col bg-background text-foreground">
      <Title>Review Inbox — Flonion</Title>
      <main class="flex flex-1 flex-col overflow-hidden bg-background md:flex-row">
        <aside class="flex h-full w-full shrink-0 flex-col border-b border-border bg-card md:w-1/3 md:min-w-[320px] md:max-w-100 md:border-b-0 md:border-r">
          <div class="shrink-0 border-b border-border bg-card p-4">
            <div class="relative">
              <Search
                size={18}
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={(searchParams.q ?? "").toString()}
                onInput={(e) =>
                  setSearchParams({ q: e.currentTarget.value || undefined })
                }
                placeholder="Search reviews..."
                aria-label="Search reviews"
                class="w-full rounded-control border border-border bg-card py-2 pl-10 pr-4 text-base text-foreground outline-none transition-all focus:ring-1 focus:ring-primary"
              />
            </div>

            <fieldset class="mt-3 flex gap-2 overflow-x-auto border-0 p-0 pb-1">
              <legend class="sr-only">Filter reviews</legend>
              <For each={FILTERS}>
                {(filter) => (
                  <FilterButton
                    label={`${filter.label} (${counts()[filter.value === "needs-reply" ? "needsReply" : filter.value]})`}
                    selected={activeFilter() === filter.value}
                    onSelect={() => setFilter(filter.value)}
                  />
                )}
              </For>
            </fieldset>
          </div>

          <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            <Show when={!isLoading() && !hasError()}>
              <Show
                when={filteredReviews().length > 0}
                fallback={
                  <Show
                    when={isConnected()}
                    fallback={
                      <EmptyState
                        icon={Sparkles}
                        title="Connect Google to see reviews"
                        description="Link your Google Business Profile to triage reviews, draft AI replies, and track redirects."
                        primaryLabel="Connect Google"
                        primaryHref={`/api/google/auth?returnTo=${encodeURIComponent(location.pathname)}`}
                      />
                    }
                  >
                    <EmptyState
                      icon={Sparkles}
                      title="All caught up"
                      description="Every review has a reply. Ask for more reviews to keep the momentum going."
                      primaryLabel="Ask for a review"
                      primaryHref="/reviews/new"
                    />
                  </Show>
                }
              >
                <For each={filteredReviews()}>
                  {(review) => (
                    <ReviewListItem
                      review={review}
                      active={selectedReviewId() === review.id}
                      onSelect={() => setSelectedReviewId(review.id)}
                    />
                  )}
                </For>
              </Show>
            </Show>

            <Show when={isLoading()}>
              <SkeletonRows count={4} />
            </Show>

            <Show when={hasError()}>
              <WidgetError
                message="Could not load reviews. Your connection may have expired."
                onRetry={() => setTrigger((t) => t + 1)}
                retryLabel="Retry"
              />
            </Show>

            <Show when={isEmpty() && !isConnected()}>
              <div class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-sm text-muted-foreground">
                  No reviews found. Connect your Google Business Profile to get
                  started.
                </p>
                <a
                  href={`/api/google/auth?returnTo=${encodeURIComponent(location.pathname)}`}
                  rel="external"
                  class="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Connect Google
                </a>
              </div>
            </Show>

            <Show when={isEmpty() && isConnected()}>
              <div class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-sm text-muted-foreground">
                  No reviews found for your Google Business Profile locations.
                </p>
              </div>
            </Show>
          </div>
        </aside>

        <section class="flex flex-1 flex-col overflow-y-auto bg-background">
          <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
            <Show when={selectedReview()}>
              <div class="overflow-hidden rounded-card border border-border bg-card shadow-sm">
                <div class="p-6">
                  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="flex items-center gap-4">
                      <InitialsAvatar
                        initials={selectedReview()!.initials}
                        tone={selectedReview()!.avatarTone}
                        size="md"
                      />
                      <div>
                        <h2 class="text-xl font-semibold text-foreground">
                          {selectedReview()!.name}
                        </h2>
                        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span class="flex items-center gap-1">
                            <CalendarDays size={14} />
                            {selectedReview()!.ago}
                          </span>
                          <span>•</span>
                          <span class="flex items-center gap-1">
                            <img
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBl511ztrsTonQZOfk16KTkke_dD0IJ_d2yQW6-_rrjJqwV0tKm1KbZPOxlmGthkvr6l4SW_LhiIG4SukGcwl37trySGOVERWWDrgIT9sQCk_zJ_fquRPKkDI8rTJp1XULelVqzMFbVUuDKs1s77hiiqCZOrohEgukR1EVe72Eg3C2xQZwdZqt534lnBC0e6ObhQlxEIhEWnq5JPMOwtVIdHgw1Tfa3rizk2Y2VvMYdTnXAnNbXXB8HnA"
                              alt=""
                              class="h-3 w-3 object-contain"
                            />
                            Google Maps
                          </span>
                        </div>
                      </div>
                    </div>

                    <RatingStars
                      rating={selectedReview()!.rating}
                      pill
                      size={18}
                    />
                  </div>

                  <div class="max-w-none text-base text-foreground">
                    <p>
                      {selectedReview()!.fullReview ??
                        selectedReview()!.preview}
                    </p>
                  </div>

                  <div class="mt-6 flex flex-wrap items-center gap-2">
                    <SentimentBadge
                      sentiment={sentimentOf(selectedReview()!.rating)}
                    />
                    <span class="tnum rounded bg-muted px-2 py-1 text-sm text-muted-foreground">
                      {selectedReview()!.source} • {selectedReview()!.rating}/5
                    </span>
                  </div>
                </div>

                <div class="mx-6 border-t border-border" />

                <div class="flex flex-col gap-4 p-6">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex items-center gap-2 text-primary">
                      <Sparkles size={20} />
                      <h3 class="text-xl font-medium">
                        AI-Powered Reply
                      </h3>
                    </div>

                    <div class="flex flex-wrap items-end gap-2">
                      <div class="grid gap-1">
                        <label
                          for="reply-tone"
                          class="text-xs font-medium text-muted-foreground"
                        >
                          Tone
                        </label>
                        <select
                          id="reply-tone"
                          value={tone()}
                          onChange={(e) =>
                            setTone(e.currentTarget.value as ReplyTone)
                          }
                          disabled={replyStatus() === "pending"}
                          class="h-9 rounded-control border border-border bg-card px-3 text-base text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                        >
                          <For each={TONES}>
                            {(t) => <option value={t.value}>{t.label}</option>}
                          </For>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={generateReply}
                        disabled={replyStatus() === "pending"}
                        class="inline-flex h-9 items-center gap-1 rounded-control border border-border bg-card px-3 py-1.5 text-base transition-opacity duration-[180ms] hover:bg-muted disabled:opacity-60 motion-reduce:transition-none"
                      >
                        <RotateCcw size={18} aria-hidden="true" />
                        {replyStatus() === "pending"
                          ? "Drafting…"
                          : "Generate reply"}
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label
                      for="reply-editor"
                      class="text-sm font-medium text-foreground"
                    >
                      Reply
                    </label>
                    <textarea
                      id="reply-editor"
                      value={replyText()}
                      onInput={(e) => {
                        setReplyText(e.currentTarget.value);
                        if (replyStatus() === "ready") setReplyStatus("idle");
                      }}
                      disabled={replyStatus() === "pending"}
                      class="min-h-37.5 w-full resize-none overflow-y-auto rounded-control border border-border bg-background p-4 text-base text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                      placeholder="Generate an AI reply, or write your own…"
                    />
                    <Show when={replyStatus() === "pending"}>
                      <p class="text-xs text-muted-foreground animate-pulse">
                        Drafting reply…
                      </p>
                    </Show>
                    <Show when={replyStatus() === "error" && replyError()}>
                      <WidgetError
                        message={replyError()}
                        onRetry={generateReply}
                        retryLabel="Retry"
                      />
                    </Show>
                  </div>

                  <div aria-live="polite" aria-atomic="true" class="sr-only">
                    {replyAnnouncement()}
                  </div>

                  <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("reply-editor")?.focus()
                      }
                      class="rounded-control border border-border bg-card px-4 py-2 text-base font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted disabled:opacity-60 motion-reduce:transition-none"
                    >
                      Edit Manually
                    </button>
                    <button
                      type="button"
                      onClick={publishReply}
                      disabled={!replyText().trim()}
                      class="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-opacity duration-[180ms] hover:bg-primary-hover disabled:opacity-60 motion-reduce:transition-none"
                    >
                      <Send size={18} aria-hidden="true" />
                      Publish Reply
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={!selectedReview() && !isLoading()}>
              <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p class="text-base text-muted-foreground">
                  Select a review to view details
                </p>
              </div>
            </Show>
          </div>
        </section>
      </main>
    </div>
  );
}
