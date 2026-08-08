import CheckCircle from "lucide-solid/icons/check-circle";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Title } from "@solidjs/meta";
import type {
  Rating,
  ReviewDraft,
  ReviewSuggestion,
  SharedReview,
} from "@/features/reviews/review-types";
import { RecentReviewsWidget } from "~/components/review/recent-reviews-widget";
import { ReviewComposer } from "~/components/review/review-composer";
import { QRCodeDisplay } from "~/components/review/qr-code-display";
import { SuggestionCard } from "~/components/review/suggestion-card";
import { useSettings } from "~/stores/settings-store";

const tones = ["Simple", "Professional", "Casual"] as const;

const initialDraft: ReviewDraft = {
  rating: 0,
  text: "",
};

const mockRecentReviews: SharedReview[] = [
  {
    id: "r1",
    text: "Absolutely love the service! The team went above and beyond to help me. Will definitely come back again.",
    rating: 5,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    reviewerName: "Sarah M.",
  },
  {
    id: "r2",
    text: "Good experience overall. The staff was friendly but the wait time was a bit long.",
    rating: 4,
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
    reviewerName: "James K.",
  },
  {
    id: "r3",
    text: "Decent quality for the price. Nothing special but got the job done.",
    rating: 3,
    createdAt: new Date(Date.now() - 172800_000).toISOString(),
    reviewerName: "Alex T.",
  },
];

function isSuccessMessage(msg: string): boolean {
  return (
    msg.includes("successfully") ||
    msg.includes("copied") ||
    msg.includes("applied") ||
    msg.includes("marked ready")
  );
}

export default function LeaveReviewPage() {
  const { logo, businessName, phone, address, keywords } = useSettings();
  const [draft, setDraft] = createSignal<ReviewDraft>(initialDraft);
  const [suggestions, setSuggestions] =
    createSignal<ReviewSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [cooldown, setCooldown] = createSignal(false);
  const [shareUrl, setShareUrl] = createSignal<string | null>(null);
  const [reviewId, setReviewId] = createSignal<string | null>(null);

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
    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          rating: 0,
          keywords: keywords(),
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        setShareUrl(`${window.location.origin}${url}`);
        const parts = url.split("/");
        setReviewId(parts[parts.length - 1] || null);
      }
    } catch {
      // QR code will remain in placeholder state if initial generation fails
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
        recommended: i === 0,
      }));

      setSuggestions(mapped);
      setStatusMessage("AI suggestions generated successfully.");

      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
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

    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: reviewText,
          rating: draft().rating,
          keywords: keywords(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const { url } = await response.json();
      const fullUrl = `${window.location.origin}${url}`;

      setShareUrl(fullUrl);
      const parts = url.split("/");
      setReviewId(parts[parts.length - 1] || null);

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
      <Title>Ask for a Review — Flonion</Title>
      <nav aria-label="Breadcrumb" class="mb-2 text-sm text-muted-foreground">
        <ol class="flex items-center gap-1.5">
          <li>
            <a
              href="/reviews/inbox"
              class="hover:text-foreground transition-colors"
            >
              Reviews
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" class="font-medium text-foreground">
            Ask for a Review
          </li>
        </ol>
      </nav>

      <div class="mb-6">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ask for a Review
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Send a personalized review request to your customer.
        </p>
      </div>

      <div class="space-y-6">
        <div class="flex flex-col gap-6 lg:flex-row">
          <div class="min-w-0 flex-1">
            <ReviewComposer
              draft={draft()}
              logo={logo()}
              businessName={businessName()}
              phone={phone()}
              address={address()}
              heading="Review Request"
              ratingLabel="Suggested rating (optional)"
              ratingHint="Your customer can change this before submitting."
              placeholder={`Hi! We'd love to hear about your experience with ${businessName()}...`}
              submitLabel="Create Review Request"
              aiButtonLabel="Improve with AI"
              showShareButton
              actions={{
                setRating,
                setText,
                fetchSuggestions,
                shareReview,
                submitReview,
              }}
              aiLoading={loading()}
              cooldown={cooldown()}
            />
          </div>
          <div class="w-full shrink-0 sm:w-52 lg:w-56">
            <QRCodeDisplay
              url={shareUrl()}
              logo={logo()}
              businessName={businessName()}
              reviewId={reviewId()}
            />
          </div>
        </div>

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
                Write a message and click Improve with AI to generate clearer, more engaging versions.
              </p>
            </Show>
          </div>
        </section>
      </div>

      <div class="mt-8 max-w-2xl border-t border-border pt-6">
        <RecentReviewsWidget reviews={mockRecentReviews} showViewAll />
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
              fallback={<AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />}
            >
              <CheckCircle class="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
            </Show>
            <p class="flex-1">{statusMessage()}</p>
          </div>
        </div>
      </Show>
    </div>
  );
}
