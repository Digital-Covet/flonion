import { For, Show, createMemo, createResource, createSignal, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import { Title } from "@solidjs/meta";
import CalendarDays from "lucide-solid/icons/calendar-days";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import Search from "lucide-solid/icons/search";
import Send from "lucide-solid/icons/send";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import type { Review } from "~/types";
import { googleStarRatingToNumber, type GoogleReview } from "~/types/google";

type FilterChip = {
  label: string;
  selected?: boolean;
};

const filters: FilterChip[] = [
  { label: "All (0)", selected: true },
  { label: "Needs Reply (0)" },
  { label: "Google" },
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

async function fetchReviews(): Promise<{ reviews: Review[]; connected: boolean }> {
  if (isServer) return { reviews: [], connected: false };

  try {
    const locationsRes = await fetch("/api/google/locations");
    if (locationsRes.status === 401) return { reviews: [], connected: false };

    const locationsData = await locationsRes.json();
    if (locationsData.error) return { reviews: [], connected: false };

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

    return { reviews: allReviews, connected: true };
  } catch {
    return { reviews: [], connected: false };
  }
}

function RatingStars(props: { rating: number; pill?: boolean; size?: number }) {
  const stars = [0, 1, 2, 3, 4];
  const size = props.size ?? 16;

  return (
    <div
      classList={{
        "flex items-center text-amber-400": true,
        "rounded-full bg-amber-400/10 px-3 py-1": !!props.pill,
      }}
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

function FilterButton(props: FilterChip) {
  return (
    <button
      type="button"
      classList={{
        "whitespace-nowrap rounded-full px-3 py-1 text-body-sm": true,
        "bg-muted text-foreground": !!props.selected,
        "border border-border bg-card text-muted-foreground hover:bg-muted": !props.selected,
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
  const sizeClass = props.size === "md" ? "h-12 w-12 text-heading-3" : "h-8 w-8 text-body";
  const toneClass =
    props.tone === "destructive"
      ? "bg-destructive-soft text-destructive"
      : "bg-primary-soft text-primary-soft-foreground";

  return (
    <div
      class={`inline-flex items-center justify-center rounded-full font-semibold ${sizeClass} ${toneClass}`}
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
      classList={{
        "group relative w-full overflow-hidden rounded-xl border p-4 text-left transition-shadow": true,
        "border-primary bg-card shadow-sm": props.active,
        "border-border bg-card hover:shadow-sm": !props.active,
      }}
    >

      <div class="mb-2 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <InitialsAvatar initials={props.review.initials} tone={props.review.avatarTone} />
          <div class="min-w-0">
            <h3 class="truncate text-body font-medium text-foreground">{props.review.name}</h3>
            <p class="text-body-sm text-muted-foreground">
              {props.review.ago} via {props.review.source}
            </p>
          </div>
        </div>
        <RatingStars rating={props.review.rating} />
      </div>

      <p class="line-clamp-2 text-body-sm text-muted-foreground">{props.review.preview}</p>

      <Show when={props.review.draftReady}>
        <div class="mt-3 flex items-center gap-1 text-primary">
          <Sparkles size={14} />
          <span class="text-body-sm font-medium">Draft Ready</span>
        </div>
      </Show>
    </button>
  );
}

export default function ReviewInbox() {
  const [selectedReviewId, setSelectedReviewId] = createSignal<string>("");
  const [trigger, setTrigger] = createSignal(0);
  const [isConnected, setIsConnected] = createSignal(false);

  const [reviews] = createResource(trigger, async () => {
    const result = await fetchReviews();
    setIsConnected(result.connected);
    return result.reviews;
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      window.history.replaceState({}, "", "/reviews/inbox");
      setTrigger((t) => t + 1);
    }
  });

  const selectedReview = createMemo(() => {
    const list = reviews() ?? [];
    return list.find((r) => r.id === selectedReviewId()) ?? list[0];
  });

  const tags = ["Positive Sentiment", "Customer Service"];

  const isLoading = createMemo(() => reviews.state === "pending");
  const hasError = createMemo(() => reviews.state === "errored");
  const isEmpty = createMemo(() => reviews.state === "ready" && (reviews() ?? []).length === 0);

  return (
    <div class="flex h-full min-w-0 flex-1 flex-col bg-background text-foreground">
      <Title>Review Inbox — Cognitive Enterprise</Title>
      <main class="flex flex-1 flex-col overflow-hidden bg-background md:flex-row">
        <aside class="flex h-full w-full shrink-0 flex-col border-b border-border bg-card md:w-1/3 md:min-w-[320px] md:max-w-100 md:border-b-0 md:border-r">
          <div class="shrink-0 border-b border-border bg-card p-4">
            <div class="relative">
              <Search
                size={18}
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search reviews..."
                class="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-body text-foreground outline-none transition-all focus:ring-1 focus:ring-primary"
              />
            </div>

            <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
              <For each={filters}>{(filter) => <FilterButton {...filter} />}</For>
            </div>
          </div>

          <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            <Show when={!isLoading() && !hasError()}>
              <For each={reviews() ?? []}>
                {(review) => (
                  <ReviewListItem
                    review={review}
                    active={selectedReviewId() === review.id}
                    onSelect={() => setSelectedReviewId(review.id)}
                  />
                )}
              </For>
            </Show>

            <Show when={isLoading()}>
              <div class="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span class="text-body-sm">Loading reviews...</span>
              </div>
            </Show>

            <Show when={hasError()}>
              <div class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-body-sm text-muted-foreground">
                  Could not load reviews. Connect your Google Business Profile.
                </p>
                <a
                  href="/api/google/auth"
                  rel="external"
                  class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Connect Google
                </a>
              </div>
            </Show>

            <Show when={isEmpty() && !isConnected()}>
              <div class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-body-sm text-muted-foreground">
                  No reviews found. Connect your Google Business Profile to get started.
                </p>
                <a
                  href="/api/google/auth"
                  rel="external"
                  class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Connect Google
                </a>
              </div>
            </Show>

            <Show when={isEmpty() && isConnected()}>
              <div class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-body-sm text-muted-foreground">
                  No reviews found for your Google Business Profile locations.
                </p>
              </div>
            </Show>
          </div>
        </aside>

        <section class="flex flex-1 flex-col overflow-y-auto bg-background">
          <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
            <Show when={selectedReview()}>
              <div class="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div class="p-6">
                  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="flex items-center gap-4">
                      <InitialsAvatar
                        initials={selectedReview()!.initials}
                        tone={selectedReview()!.avatarTone}
                        size="md"
                      />
                      <div>
                        <h2 class="text-heading-3 font-semibold text-foreground">
                          {selectedReview()!.name}
                        </h2>
                        <div class="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
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

                    <RatingStars rating={selectedReview()!.rating} pill size={18} />
                  </div>

                  <div class="max-w-none text-body-lg text-foreground">
                    <p>{selectedReview()!.fullReview ?? selectedReview()!.preview}</p>
                  </div>

                  <div class="mt-6 flex flex-wrap gap-2">
                    <For each={tags}>
                      {(tag) => (
                        <span class="rounded px-2 py-1 text-body-sm text-muted-foreground bg-muted">
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>
                </div>

                <div class="mx-6 border-t border-border" />

                <div class="flex flex-col gap-4 p-6">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex items-center gap-2 text-primary">
                      <Sparkles size={20} />
                      <h3 class="text-heading-3 font-semibold">AI-Powered Reply</h3>
                    </div>

                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-body transition-colors hover:bg-muted"
                      >
                        <SlidersHorizontal size={18} />
                        Tone: Professional
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-body transition-colors hover:bg-muted"
                      >
                        <RotateCcw size={18} />
                        Regenerate
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2">
                    <textarea
                      class="min-h-37.5 w-full resize-none overflow-y-auto rounded-lg border border-border bg-background p-4 text-body text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
                      placeholder="Drafting reply..."
                      value=""
                    />
                  </div>

                  <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      class="rounded-lg border border-border bg-card px-4 py-2 text-body font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Edit Manually
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-body font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                    >
                      <Send size={18} />
                      Publish Reply
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={!selectedReview() && !isLoading()}>
              <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p class="text-body-lg text-muted-foreground">
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
