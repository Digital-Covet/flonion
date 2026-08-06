import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import CheckCircle from "lucide-solid/icons/check-circle";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import MapPin from "lucide-solid/icons/map-pin";
import Phone from "lucide-solid/icons/phone";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import type {
  Rating,
  ReviewDraft,
  ReviewSuggestion,
} from "@/features/reviews/review-types";
import { ReviewComposer } from "~/components/review/review-composer";
import { SuggestionCard } from "~/components/review/suggestion-card";
import Wordmark from "@/assets/wordmark";
import { toSlug } from "~/lib/slug";

interface BusinessInfo {
  logo: string | null;
  name: string;
  phone: string | null;
  address: string | null;
}

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
  const [business, setBusiness] = createSignal<BusinessInfo | null>(null);
  const [companyMismatch, setCompanyMismatch] = createSignal(false);

  const [draft, setDraft] = createSignal<ReviewDraft>({ rating: 5, text: "" });
  const [suggestions, setSuggestions] = createSignal<ReviewSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [aiLoading, setAiLoading] = createSignal(false);
  const [cooldown, setCooldown] = createSignal(false);

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

    const companyname = pathParts[2];
    const id = pathParts[4];

    if (!id) {
      setError("No review ID provided.");
      setLoading(false);
      return;
    }

    if (!companyname) {
      setError("No company name provided.");
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
      if (data.business) {
        setBusiness(data.business);

        const expectedSlug = toSlug(data.business.name);
        if (expectedSlug !== companyname) {
          setCompanyMismatch(true);
          setError(
            `This review link is not valid for "${data.business.name}".`,
          );
        }
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
    const id = reviewId();
    if (!text) {
      setStatusMessage("Write some review text first to get AI suggestions.");
      return;
    }

    if (!id) {
      setStatusMessage("Review ID not found. Please reload the page.");
      return;
    }

    setAiLoading(true);
    setStatusMessage("Generating AI suggestions...");

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: id,
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

      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
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
    submitted()
      ? `Review ${business()?.name || "Submitted"}`
      : business()?.name
        ? `Review ${business()?.name}`
        : "Leave a Review";

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Meta name="description" content="Leave a review for this business." />

      <div class="flex min-h-dvh flex-col items-center bg-background px-4 py-8 sm:py-12 hero-gradient">
        <Show when={!loading()}>
          <Show
            when={!error()}
            fallback={
              <div class="w-full max-w-lg animate-[fade-in-up_0.4s_ease-out_both] rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-md backdrop-blur-sm sm:p-10">
                <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive-muted">
                  <AlertTriangle class="size-7 text-destructive" />
                </div>
                <p class="font-heading text-xl font-semibold text-foreground">
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
                <div class="w-full max-w-lg animate-[fade-in-up_0.4s_ease-out_both] rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-md backdrop-blur-sm sm:p-10">
                  <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple/10">
                    <CheckCircle class="size-8 text-primary" />
                  </div>
                  <h1 class="font-heading text-2xl font-bold text-foreground">
                    Thank you!
                  </h1>
                  <p class="mt-2 text-sm text-muted-foreground">
                    Your review has been submitted successfully.
                  </p>
                  <Show when={business()}>
                    <div class="mt-6 border-t border-border/60 pt-5">
                      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {business()?.name}
                      </p>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class="flex w-full max-w-2xl flex-col gap-6">
                <Show when={business()}>
                  <div class="glass-card rounded-2xl p-6 shadow-md sm:p-8 animate-[fade-in-up_0.4s_ease-out_both]">
                    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                      <Show
                        when={business()?.logo}
                        fallback={
                          <div class="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple/10 text-3xl font-bold text-primary sm:size-24">
                            {business()?.name?.charAt(0) || "?"}
                          </div>
                        }
                      >
                        <img
                          src={business()!.logo!}
                          alt={`${business()?.name} logo`}
                          class="size-20 shrink-0 rounded-2xl object-cover shadow-md sm:size-24"
                        />
                      </Show>

                      <div class="flex-1 text-center sm:text-left">
                        <h1 class="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                          {business()?.name}
                        </h1>

                        <div class="mt-3 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:items-start">
                          <Show when={business()?.address}>
                            <div class="flex items-center gap-2">
                              <MapPin class="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                              <span>{business()?.address}</span>
                            </div>
                          </Show>
                          <Show when={business()?.phone}>
                            <div class="flex items-center gap-2">
                              <Phone class="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                              <span>{business()?.phone}</span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>

                    <div class="mt-5 border-t border-border/60 pt-4 text-center sm:text-left">
                      <p class="text-xs font-medium text-muted-foreground/70">
                        Share your experience with {business()?.name}
                      </p>
                    </div>
                  </div>
                </Show>

                <Show when={!business()}>
                  <div class="animate-[fade-in-up_0.4s_ease-out_both] text-center">
                    <h1 class="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                      Leave a Review
                    </h1>
                    <p class="mt-2 text-sm text-muted-foreground">
                      Share your experience below
                    </p>
                  </div>
                </Show>

                <div class="animate-[fade-in-up_0.4s_ease-out_0.1s_both]">
                  <ReviewComposer
                    draft={draft()}
                    actions={{
                      setRating,
                      setText,
                      fetchSuggestions,
                      submitReview,
                    }}
                    logo={business()?.logo}
                    businessName={business()?.name}
                    hideBusinessInfo
                    aiLoading={aiLoading()}
                    cooldown={cooldown()}
                  />
                </div>

                <section
                  aria-labelledby="suggestions-heading"
                  class="animate-[fade-in-up_0.4s_ease-out_0.2s_both]"
                >
                  <div class="flex items-center gap-2">
                    <Sparkles class="size-5 text-primary" aria-hidden="true" />
                    <h2
                      id="suggestions-heading"
                      class="font-heading text-lg font-semibold text-foreground"
                    >
                      AI Suggestions
                    </h2>
                    <Show when={aiLoading()}>
                      <span class="ml-auto text-xs text-muted-foreground animate-pulse">
                        Thinking...
                      </span>
                    </Show>
                  </div>

                  <div class="mt-4 space-y-3">
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
                      <div class="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
                        <Sparkles class="mx-auto mb-2 size-5 text-muted-foreground/40" aria-hidden="true" />
                        <p class="text-sm text-muted-foreground">
                          No suggestions yet. Write a review draft and click{" "}
                          <span class="font-medium text-foreground">AI Suggest</span>{" "}
                          to generate improved versions.
                        </p>
                      </div>
                    </Show>
                  </div>
                </section>

                <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                  Powered by{" "}
                  <Wordmark class="h-3.5 w-auto text-muted-foreground/60" />
                </p>
              </div>
            </Show>
          </Show>
        </Show>

        <Show when={loading()}>
          <div class="w-full max-w-lg animate-[fade-in-up_0.4s_ease-out_both] rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-md backdrop-blur-sm sm:p-10">
            <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <div class="size-5 animate-pulse rounded-full bg-muted-foreground/20" />
            </div>
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
            class={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-md backdrop-blur-sm ${
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
