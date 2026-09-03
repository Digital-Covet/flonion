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
import MapPin from "lucide-solid/icons/map-pin";
import Phone from "lucide-solid/icons/phone";
import ExternalLink from "lucide-solid/icons/external-link";
import type {
  Rating,
  ReviewDraft,
  ReviewSuggestion,
} from "@/features/reviews/review-types";
import { ReviewComposer } from "~/components/review/review-composer";
import InlineCombinationMark from "@/assets/inline-combination-mark";
import {
  REVIEW_PLATFORMS,
  getPlatformBySlug,
  getPlatformLabel,
  CUSTOM_LABEL_KEY,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";

interface BusinessInfo {
  logo: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  placeId: string | null;
  reviewLink: string | null;
  reviewLinks: ReviewLinksMap | null;
}

const tones = ["Simple", "Professional", "Casual"] as const;

function isCuid(value: string): boolean {
  return /^c[a-z0-9]{20,}$/.test(value);
}

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

  const [draft, setDraft] = createSignal<ReviewDraft>({ rating: 0, text: "" });
  const [suggestions, setSuggestions] = createSignal<ReviewSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [aiLoading, setAiLoading] = createSignal(false);
  const [cooldown, setCooldown] = createSignal(false);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [visitorName, setVisitorName] = createSignal("");
  const [businessId, setBusinessId] = createSignal<string | null>(null);

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

    const urlParam = pathParts[2];

    if (!urlParam) {
      setError("No business identifier provided.");
      setLoading(false);
      return;
    }

    const isBusinessId = isCuid(urlParam);
    if (isBusinessId) {
      setBusinessId(urlParam);
    }

    const query = isBusinessId
      ? `businessId=${encodeURIComponent(urlParam)}`
      : `username=${encodeURIComponent(urlParam)}`;

    try {
      const response = await fetch(`/api/reviews/share?${query}`);

      if (!response.ok) {
        setError(
          "Business not found. The link may be invalid.",
        );
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.keywords) {
        setKeywords(data.keywords);
      }
      if (data.business) {
        setBusiness(data.business);
      }

      const createResponse = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          rating: 0,
          ...(isBusinessId ? { businessId: urlParam } : { username: urlParam }),
        }),
      });

      if (createResponse.ok) {
        const { reviewId: rid } = await createResponse.json();
        if (rid) {
          setReviewId(rid);
          fetch("/api/reviews/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewId: rid, type: "visit" }),
          }).catch(() => {});
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
    if (!aiLoading() && !cooldown()) {
      fetchSuggestions();
    }
  };

  const setText = (text: string) => {
    setDraft((current) => ({ ...current, text }));
  };

  const fetchSuggestions = async () => {
    const text = draft().text.trim();
    const id = reviewId();
    const rating = draft().rating;

    if (!rating) {
      setStatusMessage("Select a star rating first.");
      return;
    }

    setAiLoading(true);
    setShowSuggestions(true);
    setStatusMessage("Generating AI suggestions...");

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: id || undefined,
          draftText: text || undefined,
          starRating: rating,
          keywords: keywords() || undefined,
          businessName: business()?.name || undefined,
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

  const applySuggestion = async (suggestion: ReviewSuggestion) => {
    setText(suggestion.text);
    setStatusMessage(`${suggestion.tone} suggestion applied to the draft.`);

    try {
      await navigator.clipboard.writeText(suggestion.text);
    } catch {
      // clipboard write may fail without user gesture; non-critical
    }

    const id = reviewId();
    if (id) {
      fetch("/api/reviews/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: id, type: "ai_copy" }),
      }).catch(() => {});
    }
  };

  const dismissSuggestion = (suggestionId: string) => {
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.id !== suggestionId),
    );
  };

  const submitReview = async () => {
    const reviewText = draft().text;
    const id = reviewId();
    const urlParam = window.location.pathname.split("/")[2];
    const isBusinessIdParam = urlParam ? isCuid(urlParam) : false;

    if (!reviewText.trim()) {
      setStatusMessage("Enter review text before submitting.");
      return;
    }

    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(id ? { id } : {}),
          ...(urlParam && !id && isBusinessIdParam ? { businessId: urlParam } : {}),
          ...(urlParam && !id && !isBusinessIdParam ? { username: urlParam } : {}),
          text: reviewText,
          rating: draft().rating,
          reviewerName: visitorName() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      await navigator.clipboard.writeText(reviewText);

      if (id) {
        fetch("/api/reviews/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId: id, type: "review" }),
        }).catch(() => {});
      }

      setSubmitted(true);
      setStatusMessage("Text Copied");
    } catch {
      setStatusMessage("Could not submit review. Please try again.");
    }
  };

  const shareReview = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatusMessage("Review link copied to clipboard!");
    } catch {
      setStatusMessage(`Review link: ${window.location.href}`);
    }
  };

  const trackRedirect = (platform?: string) => {
    const id = reviewId();
    if (!id) return;
    fetch("/api/reviews/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId: id, type: "redirect", platform }),
    }).catch(() => {});
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
                  <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-purple/10">
                    <CheckCircle class="size-8 text-primary" />
                  </div>
                  <h1 class="font-heading text-2xl font-bold text-foreground">
                    Thank you!
                  </h1>
                  <p class="mt-2 text-sm text-muted-foreground">
                    Your review is ready. Choose a platform to post it on:
                  </p>
                  <div class="mt-6 flex flex-col items-center gap-3">
                    <Show
                      when={
                        business()?.reviewLinks &&
                        Object.keys(business()!.reviewLinks!).filter(
                          (k) => k !== CUSTOM_LABEL_KEY,
                        ).length > 0
                      }
                      fallback={
                        <a
                          href={
                            business()?.reviewLink ||
                            `https://search.google.com/local/writereview?placeid=${business()?.placeId}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackRedirect("google")}
                          class="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                        >
                          <ExternalLink class="size-4" />
                          Continue to Google
                        </a>
                      }
                    >
                      <For
                        each={Object.entries(business()!.reviewLinks!).filter(
                          ([key]) => key !== CUSTOM_LABEL_KEY && key !== "other" || (key === "other" && business()!.reviewLinks!["other"]),
                        )}
                      >
                            {([slug, url]) => {
                              if (!url || slug === CUSTOM_LABEL_KEY) return null;
                              const platform = getPlatformBySlug(slug);
                              const label = getPlatformLabel(slug, business()!.reviewLinks!);
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => trackRedirect(slug)}
                                  class="inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
                                  style={{
                                    "background-color": platform?.color ?? "#666",
                                  }}
                                >
                                  <ExternalLink class="size-4" />
                                  Post on {label}
                                </a>
                              );
                            }}
                      </For>
                    </Show>
                    <Show when={business()}>
                      <p class="text-xs text-muted-foreground/60">
                        {business()?.name}
                      </p>
                    </Show>
                  </div>
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
                          <div class="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-purple/10 text-3xl font-bold text-primary sm:size-24">
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
                      <p class="text-sm font-medium text-foreground">
                        How was your experience with {business()?.name}?
                      </p>
                      <p class="mt-1 text-xs text-muted-foreground/70">
                        Your feedback takes less than a minute.
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
                      setName: setVisitorName,
                      fetchSuggestions,
                      submitReview,
                      shareReview,
                      applySuggestion,
                      dismissSuggestion,
                    }}
                    logo={business()?.logo}
                    businessName={business()?.name}
                    hideBusinessInfo
                    heading="Your Review"
                    ratingLabel="How would you rate your experience?"
                    placeholder="What did you like? What could we improve?"
                    submitLabel="Submit Review"
                    aiButtonLabel="Improve with AI"
                    aiLoading={aiLoading()}
                    cooldown={cooldown()}
                    suggestions={suggestions()}
                    showSuggestions={showSuggestions()}
                    showTrustStatement
                    showShareButton
                    name={visitorName()}
                  />
                </div>

                <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                  Powered by{" "}
                  <InlineCombinationMark class="h-3.5 w-auto text-muted-foreground/60" />
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
            class={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-md backdrop-blur-sm ${isSuccessMessage(statusMessage())
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
