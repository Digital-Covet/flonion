import { createSignal, For, Show } from "solid-js";
import type {
  Rating,
  ReviewDraft,
  ReviewSuggestion,
} from "@/features/reviews/review-types";
import { ReviewComposer } from "~/components/review/review-composer";
import { SuggestionCard } from "~/components/review/suggestion-card";
import { useSettings } from "~/stores/settings-store";

const tones = ["Simple", "Professional", "Casual"] as const;

const initialDraft: ReviewDraft = {
  rating: 1,
  text: "",
};

export default function LeaveReviewPage() {
  const { logo, businessName } = useSettings();
  const [draft, setDraft] = createSignal<ReviewDraft>(initialDraft);
  const [suggestions, setSuggestions] =
    createSignal<ReviewSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [loading, setLoading] = createSignal(false);

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

    setLoading(true);
    setStatusMessage("Generating AI suggestions...");

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: text, starRating: draft().rating }),
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
      }));

      setSuggestions(mapped);
      setStatusMessage("AI suggestions generated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSuggestions([]);
      setStatusMessage(`AI service unavailable: ${message}.`);
    } finally {
      setLoading(false);
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

  const shareReview = async () => {
    const reviewText = draft().text;

    if (!reviewText.trim()) {
      setStatusMessage("Add review text before sharing.");
      return;
    }

    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reviewText, rating: draft().rating }),
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const { url } = await response.json();
      const fullUrl = `${window.location.origin}${url}`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
        setStatusMessage("Share link copied to clipboard!");
      } else {
        setStatusMessage(`Share link: ${fullUrl}`);
      }
    } catch {
      setStatusMessage("Could not generate share link. Try again later.");
    }
  };

  const submitReview = () => {
    if (!draft().text.trim()) {
      setStatusMessage("Enter review text before preparing it for submission.");
      return;
    }

    setStatusMessage(
      "Review marked ready for submission (demo only; no review was sent).",
    );
  };

  return (
    <div class="mx-auto max-w-7xl">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ask a Review
        </h1>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <ReviewComposer
            draft={draft()}
            logo={logo()}
            businessName={businessName()}
            actions={{
              setRating,
              setText,
              fetchSuggestions,
              shareReview,
              submitReview,
            }}
            aiLoading={loading()}
          />
        </div>

        <div class="space-y-6">
          <section aria-labelledby="suggestions-heading">
            <div class="flex items-center justify-between gap-3">
              <h2
                id="suggestions-heading"
                class="text-lg font-semibold text-foreground"
              >
                AI Suggestions
              </h2>
              <Show when={loading()}>
                <span class="text-xs text-muted-foreground animate-pulse">Thinking...</span>
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

              <Show when={suggestions().length === 0 && !loading()}>
                <p class="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                  No suggestions yet. Write a review draft and click AI Suggest
                  to generate improved versions.
                </p>
              </Show>
            </div>
          </section>
        </div>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        class="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-xl"
      >
        <Show when={statusMessage()}>
          <p class="rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm">
            {statusMessage()}
          </p>
        </Show>
      </div>
    </div>
  );
}
