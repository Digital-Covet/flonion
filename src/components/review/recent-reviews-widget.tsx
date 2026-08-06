import Star from "lucide-solid/icons/star";
import { For, Show } from "solid-js";
import type { SharedReview } from "@/features/reviews/review-types";

interface RecentReviewsWidgetProps {
  reviews: SharedReview[];
  showViewAll?: boolean;
}

function timeAgo(timestamp: string | number): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ratingColor(rating: number): string {
  if (rating >= 5) return "text-positive";
  if (rating >= 4) return "text-info";
  if (rating >= 3) return "text-orange";
  return "text-destructive";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RecentReviewsWidget(props: RecentReviewsWidgetProps) {
  return (
    <section aria-labelledby="recent-reviews-heading">
      <div class="flex items-center justify-between">
        <h2
          id="recent-reviews-heading"
          class="text-lg font-semibold text-foreground"
        >
          Recent Reviews
        </h2>
        <Show when={props.showViewAll}>
          <a
            href="/reviews/inbox"
            class="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            View all &rarr;
          </a>
        </Show>
      </div>

      <div class="mt-3 rounded-xl border border-border bg-card p-4 shadow-md">
        <Show
          when={props.reviews.length > 0}
          fallback={
            <p class="py-2 text-center text-sm text-muted-foreground">
              No recent reviews yet.
            </p>
          }
        >
          <ul class="space-y-2">
            <For each={props.reviews}>
              {(review) => (
                <li class="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {review.reviewerName ? initials(review.reviewerName) : "?"}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-0.5">
                        <For each={[1, 2, 3, 4, 5]}>
                          {(star) => (
                            <Star
                              class={`size-3.5 ${
                                star <= review.rating
                                  ? ratingColor(review.rating)
                                  : "text-slate-200"
                              }`}
                              fill={star <= review.rating ? "currentColor" : "none"}
                              aria-hidden="true"
                            />
                          )}
                        </For>
                      </div>
                      <Show when={review.reviewerName}>
                        <span class="text-xs font-medium text-foreground">
                          {review.reviewerName}
                        </span>
                      </Show>
                      <span class="text-xs text-muted-foreground">
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>
                    <p class="mt-1 text-sm leading-5 text-muted-foreground line-clamp-2">
                      {review.text}
                    </p>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </section>
  );
}
