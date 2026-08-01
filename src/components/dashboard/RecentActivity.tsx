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
