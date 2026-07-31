import { createSignal, For, Show, onMount } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { Star } from "lucide-solid";
import type { SharedReview } from "@/features/reviews/review-types";

export default function SharedReviewPage() {
  const [review, setReview] = createSignal<SharedReview | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      setError("No review ID provided.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/reviews/share?id=${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Review not found. The link may have expired.");
        } else {
          setError("Failed to load review.");
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setReview(data);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  });

  const pageTitle = () => {
    const r = review();
    if (!r) return "Shared Review";
    return `${r.rating}-Star Review — Shared via RevMe`;
  };

  const pageDescription = () => {
    const r = review();
    if (!r) return "View a shared review.";
    const preview = r.text.length > 120 ? r.text.slice(0, 120) + "..." : r.text;
    return `${r.rating}/5 stars: ${preview}`;
  };

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Meta property="og:title" content={pageTitle()} />
      <Meta property="og:description" content={pageDescription()} />
      <Meta property="og:type" content="article" />
      <Meta name="description" content={pageDescription()} />

      <div class="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
        <Show when={!loading()}>
          <Show
            when={review()}
            fallback={
              <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <p class="text-lg font-medium text-foreground">
                  {error() || "Review not available."}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  This link may be invalid or expired.
                </p>
              </div>
            }
          >
            <div class="w-full max-w-md">
              <div class="mb-6 text-center">
                <h1 class="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                  Shared Review
                </h1>
              </div>

              <div class="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div class="flex gap-1">
                  <For each={Array.from({ length: 5 })}>
                    {(_, i) => (
                      <Star
                        class="size-5"
                        fill={i() < review()!.rating ? "currentColor" : "none"}
                        classList={{
                          "text-primary": i() < review()!.rating,
                          "text-slate-300": i() >= review()!.rating,
                        }}
                      />
                    )}
                  </For>
                </div>

                <p class="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {review()!.text}
                </p>

                <div class="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <p class="text-xs text-muted-foreground">
                    Shared on{" "}
                    {new Date(review()!.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p class="text-xs font-medium text-primary">RevMe</p>
                </div>
              </div>
            </div>
          </Show>
        </Show>

        <Show when={loading()}>
          <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <p class="text-sm text-muted-foreground">Loading review...</p>
          </div>
        </Show>
      </div>
    </>
  );
}
