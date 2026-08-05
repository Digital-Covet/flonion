import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import CheckCircle from "lucide-solid/icons/check-circle";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Star from "lucide-solid/icons/star";
import type {
  Rating,
  ReviewDraft,
  ReviewSuggestion,
} from "@/features/reviews/review-types";
import { ReviewComposer } from "~/components/review/review-composer";
import { SuggestionCard } from "~/components/review/suggestion-card";

const tones = ["Simple", "Professional", "Casual"] as const;

function isSuccessMessage(msg: string): boolean {
  return (
    msg.includes("successfully") ||
    msg.includes("copied") ||
    msg.includes("applied") ||
    msg.includes("Thank you")
  );
}

export default function PublicReviewPage() {
  const [reviewId, setReviewId] = createSignal<string | null>(null);
  const [keywords, setKeywords] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);

  const [draft, setDraft] = createSignal<ReviewDraft>({ rating: 5, text: "" });
  const [suggestions, setSuggestions] = createSignal<ReviewSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [aiLoading, setAiLoading] = createSignal(false);

  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const msg = statusMessage();
    if (msg) {
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => setStatusMessage(""), 4000);
    }
  });

  onCleanup(() => clearTimeout(dismissTimer));

  onMount(async () => {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      setError("No review ID provided.");
      setLoading(false);
      return;
    }

    setReviewId(id);

    try {
      const response = await fetch(`/api/reviews/share?id=${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Review link not found. It may have expired or been removed.");
        } else {
          setError("Failed to load review form.");
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.keywords) {
        setKeywords(data.keywords);
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  });

  const setRating = (rating: Rating) => {
    setDraft((current) => ({ ...current, rating }));
  };

  const setText = (text: string) => {
    setDraft((current) => ({ ...current, text }));
  };

  const fetchSuggestions = async () => {
    const text = draft().text.trim();
    if (!text) {
      setStatusMessage("Write some review text first to get AI suggestions.");
      return;
    }

    setAiLoading(true);
    setStatusMessage("Generating AI suggestions...");

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftText: text,
          starRating: draft().rating,
          keywords: keywords() || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const texts: string[] = data.suggestedReviews;

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error("No suggestions returned from AI service.");
      }

      const mapped: ReviewSuggestion[] = texts.map((t, i) => ({
        id: `ai-${Date.now()}-${i}`,
        tone: tones[i] ?? "Professional",
        text: t,
        recommended: i === 0,
      }));

      setSuggestions(mapped);
      setStatusMessage("AI suggestions generated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSuggestions([]);
      setStatusMessage(`AI service unavailable: ${message}.`);
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (suggestion: ReviewSuggestion) => {
    setText(suggestion.text);
    setStatusMessage(`${suggestion.tone} suggestion applied to the draft.`);
  };

  const dismissSuggestion = (suggestionId: string) => {
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.id !== suggestionId),
    );
  };

  const submitReview = async () => {
    const reviewText = draft().text;
    const id = reviewId();

    if (!reviewText.trim()) {
      setStatusMessage("Enter review text before submitting.");
      return;
    }

    if (!id) {
      setStatusMessage("Review ID not found. Please reload the page.");
      return;
    }

    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          text: reviewText,
          rating: draft().rating,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      setSubmitted(true);
      setStatusMessage("Thank you for your review!");
    } catch {
      setStatusMessage("Could not submit review. Please try again.");
    }
  };

  const pageTitle = () =>
    submitted() ? "Review Submitted" : "Leave a Review";

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Meta name="description" content="Leave a review for this business." />

      <div class="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
        <Show when={!loading()}>
          <Show
            when={!error()}
            fallback={
              <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <p class="text-lg font-medium text-foreground">
                  {error()}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  This link may be invalid or expired.
                </p>
              </div>
            }
          >
            <Show
              when={!submitted()}
              fallback={
                <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                  <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-positive-muted">
                    <CheckCircle class="size-6 text-positive" />
                  </div>
                  <h1 class="text-xl font-semibold text-foreground">
                    Thank you!
                  </h1>
                  <p class="mt-2 text-sm text-muted-foreground">
                    Your review has been submitted successfully.
                  </p>
                  <p class="mt-4 text-xs text-muted-foreground">RevMe</p>
                </div>
              }
            >
              <div class="w-full max-w-2xl">
                <div class="mb-6 text-center">
                  <h1 class="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Leave a Review
                  </h1>
                </div>

                <ReviewComposer
                  draft={draft()}
                  actions={{
                    setRating,
                    setText,
                    fetchSuggestions,
                    shareReview: () => {},
                    submitReview,
                  }}
                  aiLoading={aiLoading()}
                />

                <div class="mt-6">
                  <section aria-labelledby="suggestions-heading">
                    <div class="flex items-center justify-between gap-3">
                      <h2
                        id="suggestions-heading"
                        class="text-lg font-semibold text-foreground"
                      >
                        AI Suggestions
                      </h2>
                      <Show when={aiLoading()}>
                        <span class="text-xs text-muted-foreground animate-pulse">
                          Thinking...
                        </span>
                      </Show>
                    </div>

                    <div class="mt-3 space-y-3">
                      <For each={suggestions()}>
                        {(suggestion, index) => (
                          <SuggestionCard
                            suggestion={suggestion}
                            onApply={applySuggestion}
                            onDismiss={dismissSuggestion}
                            style={`animation-delay: ${index() * 80}ms`}
                          />
                        )}
                      </For>

                      <Show when={suggestions().length === 0 && !aiLoading()}>
                        <p class="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                          No suggestions yet. Write a review draft and click AI
                          Suggest to generate improved versions.
                        </p>
                      </Show>
                    </div>
                  </section>
                </div>
              </div>
            </Show>
          </Show>
        </Show>

        <Show when={loading()}>
          <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <p class="text-sm text-muted-foreground">Loading review form...</p>
          </div>
        </Show>
      </div>

      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {statusMessage()}
      </div>

      <Show when={statusMessage()}>
        <div class="fixed top-4 right-4 z-30 max-w-sm animate-[fade-in-up_0.2s_ease-out]">
          <div
            class={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-md ${
              isSuccessMessage(statusMessage())
                ? "border-positive/20 bg-positive-muted text-foreground"
                : "border-destructive/20 bg-destructive-muted text-foreground"
            }`}
          >
            <Show
              when={isSuccessMessage(statusMessage())}
              fallback={
                <AlertTriangle
                  class="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
              }
            >
              <CheckCircle
                class="mt-0.5 size-4 shrink-0 text-positive"
                aria-hidden="true"
              />
            </Show>
            <p class="flex-1">{statusMessage()}</p>
          </div>
        </div>
      </Show>
    </>
  );
}
