import Star from "lucide-solid/icons/star";
import { For } from "solid-js";
import { SentimentBadge } from "~/components/ui/badge";
import { ButtonLink } from "~/components/ui/button";
import { recentActivity } from "~/features/dashboard/data";

function sentimentOf(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export interface RecentReviewItem {
  id: string;
  name: string;
  initials: string;
  rating: number;
  preview: string;
  ago: string;
  source: string;
}

/**
 * DS §6 recent-reviews list: stars always paired with the number ("4.6 ★"
 * pattern), sentiment as icon + word + colour, and a secondary "Draft reply"
 * action per row. Falls back to sample data so the widget never renders a
 * blank list on day one.
 */
export function RecentActivity(props: { items?: RecentReviewItem[] }) {
  const items = () => props.items ?? recentActivity;

  return (
    <section
      aria-labelledby="recent-activity-heading"
      class="rounded-card border border-border bg-card p-5 shadow-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <h2
          id="recent-activity-heading"
          class="font-heading text-lg font-semibold text-foreground"
        >
          Recent reviews
        </h2>
        <a
          href="/reviews/inbox"
          class="text-xs font-medium text-primary underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all
        </a>
      </div>

      <ul class="mt-4 grid gap-3">
        <For each={items()}>
          {(review) => (
            <li class="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:flex-row sm:items-center">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                aria-hidden="true"
              >
                {review.initials}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="truncate text-sm font-medium text-foreground">
                    {review.name}
                  </span>
                  <span class="tnum inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star
                      size={12}
                      class="fill-star text-star"
                      aria-hidden="true"
                    />
                    {review.rating}/5
                  </span>
                  <SentimentBadge sentiment={sentimentOf(review.rating)} />
                </div>

                <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {review.preview}
                </p>
                <p class="tnum mt-1 text-xs text-muted-foreground">
                  {review.source} · {review.ago}
                </p>
              </div>

              <ButtonLink
                href="/reviews/inbox"
                size="sm"
                variant="outline"
                class="shrink-0"
              >
                Draft reply
              </ButtonLink>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
