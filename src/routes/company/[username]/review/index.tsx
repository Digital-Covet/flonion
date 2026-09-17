import { Field } from "@ark-ui/solid/field";
import { RatingGroup } from "@ark-ui/solid/rating-group";
import { Meta, Title } from "@solidjs/meta";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import ExternalLink from "lucide-solid/icons/external-link";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import MapPin from "lucide-solid/icons/map-pin";
import MessageSquare from "lucide-solid/icons/message-square";
import Phone from "lucide-solid/icons/phone";
import Send from "lucide-solid/icons/send";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import InlineCombinationMark from "@/assets/inline-combination-mark";
import type { Rating, ReviewSuggestion } from "@/features/reviews/review-types";
import {
  RedirectCountdown,
  SubmittedCheck,
} from "~/components/ui/redirect-countdown";
import { Skeleton } from "~/components/ui/skeleton";
import { AppToaster, notify } from "~/components/ui/toast";
import {
  CUSTOM_LABEL_KEY,
  getPlatformBySlug,
  getPlatformLabel,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";
import { httpUrl } from "~/lib/safe-url";

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
const RATE_LIMIT_COOLDOWN = 30;
const SUCCESS_COOLDOWN = 5;

function isCuid(value: string): boolean {
  return /^c[a-z0-9]{20,}$/.test(value);
}

function urlParam(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/");
  return parts[2] || null;
}

/** Fire-and-forget analytics: sendBeacon on unload-safe paths, fetch fallback. */
function track(
  reviewId: string | null,
  type: "visit" | "review" | "redirect" | "ai_copy",
  platform?: string,
) {
  if (!reviewId) return;
  const payload = JSON.stringify({ reviewId, type, platform });
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/reviews/track", blob)) return;
    }
  } catch {
    // Fall through to fetch.
  }
  fetch("/api/reviews/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export default function PublicReviewPage() {
  const [reviewId, setReviewId] = createSignal<string | null>(null);
  // Proves this page created the review row it is about to fill in.
  const [claimToken, setClaimToken] = createSignal<string | null>(null);
  const [keywords, setKeywords] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  const [business, setBusiness] = createSignal<BusinessInfo | null>(null);

  const [rating, setRating] = createSignal<Rating>(0);
  const [text, setText] = createSignal("");
  const [visitorName, setVisitorName] = createSignal("");
  const [suggestions, setSuggestions] = createSignal<ReviewSuggestion[]>([]);
  const [pickedId, setPickedId] = createSignal<string | null>(null);
  const [copiedReview, setCopiedReview] = createSignal(false);
  // Inline, persistent form errors (role=alert). Never auto-cleared.
  const [formError, setFormError] = createSignal<string | null>(null);
  // Token-expiry recovery: the claim row is gone server-side, but the draft
  // text is intact — mint a fresh row and let the user retry.
  const [claimExpired, setClaimExpired] = createSignal(false);
  const [refreshingClaim, setRefreshingClaim] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [aiLoading, setAiLoading] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);
  const [cooldownSecs, setCooldownSecs] = createSignal(0);
  const [stayed, setStayed] = createSignal(false);

  let successHeadingRef: HTMLHeadingElement | undefined;
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearInterval(cooldownTimer);
    clearTimeout(copyTimer);
  });

  const startCooldown = (secs: number) => {
    clearInterval(cooldownTimer);
    setCooldownSecs(secs);
    cooldownTimer = setInterval(() => {
      setCooldownSecs((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  onMount(async () => {
    const param = urlParam();
    if (!param) {
      setError("No business identifier provided.");
      setLoading(false);
      return;
    }

    const isBusinessId = isCuid(param);
    const query = isBusinessId
      ? `businessId=${encodeURIComponent(param)}`
      : `username=${encodeURIComponent(param)}`;

    try {
      const response = await fetch(`/api/reviews/share?${query}`);
      if (!response.ok) {
        setError("Business not found. Check the link and try again.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.keywords) setKeywords(data.keywords);
      if (data.business) setBusiness(data.business);

      const createResponse = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          rating: 0,
          ...(isBusinessId ? { businessId: param } : { username: param }),
        }),
      });

      if (createResponse.ok) {
        const { reviewId: rid, claimToken: token } =
          await createResponse.json();
        if (rid) {
          setReviewId(rid);
          if (token) setClaimToken(token);
          track(rid, "visit");
        }
      }
    } catch {
      setError("Could not connect to the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  });

  const fetchSuggestions = async () => {
    if (aiLoading() || cooldownSecs() > 0) return;
    if (!rating()) {
      setFormError("Select a star rating first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: reviewId() || undefined,
          draftText: text().trim() || undefined,
          starRating: rating(),
          keywords: keywords() || undefined,
          businessName: business()?.name || undefined,
        }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const secs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : RATE_LIMIT_COOLDOWN;
        startCooldown(secs);
        setAiError(
          `AI limit reached — your draft is preserved. Try again in ${secs}s.`,
        );
        notify("warning", "AI limit reached", "Your draft is preserved.");
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const texts: string[] = data.suggestedReviews;
      if (!Array.isArray(texts) || texts.length === 0)
        throw new Error("No suggestions returned from AI service.");

      setSuggestions(
        texts.slice(0, 3).map((t, i) => ({
          id: `ai-${Date.now()}-${i}`,
          tone: tones[i] ?? "Professional",
          text: t,
          recommended: i === 0,
        })),
      );
      setPickedId(null);
      startCooldown(SUCCESS_COOLDOWN);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setAiError(`AI service unavailable: ${message} Your draft is preserved.`);
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (suggestion: ReviewSuggestion) => {
    setText(suggestion.text);
    setPickedId(suggestion.id);
    setFormError(null);
    track(reviewId(), "ai_copy");
    notify("success", `${suggestion.tone} draft applied`, "Edit as needed.");
  };

  const submitReview = async () => {
    if (submitting()) return;
    const reviewText = text();
    const param = urlParam();
    const isBusinessIdParam = param ? isCuid(param) : false;
    const id = reviewId();

    if (!rating()) {
      setFormError("Select a star rating first.");
      return;
    }
    if (!reviewText.trim()) {
      setFormError("Write a few words about your visit before submitting.");
      return;
    }
    if (loading()) return;

    setFormError(null);
    setClaimExpired(false);
    setSubmitting(true);

    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(id ? { id, claimToken: claimToken() ?? undefined } : {}),
          ...(param && !id && isBusinessIdParam ? { businessId: param } : {}),
          ...(param && !id && !isBusinessIdParam ? { username: param } : {}),
          text: reviewText,
          rating: rating(),
          reviewerName: visitorName().trim() || undefined,
        }),
      });

      if (!response.ok) {
        // 401/403/410 = the claim row is gone (expired, revoked, or already
        // submitted elsewhere). The draft is intact — offer a fresh form.
        if ([401, 403, 410].includes(response.status)) {
          setClaimExpired(true);
          setFormError(
            "Your session expired. Your text is saved, tap to continue.",
          );
          return;
        }
        throw new Error("Failed to submit review");
      }

      track(id, "review");
      try {
        await navigator.clipboard.writeText(reviewText);
      } catch {
        // Clipboard may be unavailable — the "Copy my review" button covers it.
      }
      setSubmitted(true);
    } catch {
      setFormError("Could not submit review. Your text is preserved — retry.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Mint a fresh claim row after expiry; the draft text is untouched. */
  const refreshClaim = async () => {
    const param = urlParam();
    if (!param) return;
    const isBusinessIdParam = isCuid(param);
    setRefreshingClaim(true);
    try {
      const res = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          rating: 0,
          ...(isBusinessIdParam ? { businessId: param } : { username: param }),
        }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const { reviewId: rid, claimToken: token } = await res.json();
      if (rid) {
        setReviewId(rid);
        if (token) setClaimToken(token);
        setClaimExpired(false);
        setFormError(null);
        notify("success", "Session renewed", "Tap Submit review to retry.");
      }
    } catch {
      setFormError("Could not start a fresh submission. Please try again.");
    } finally {
      setRefreshingClaim(false);
    }
  };

  const copyMyReview = async () => {
    try {
      await navigator.clipboard.writeText(text());
    } catch {
      // Clipboard unavailable — still show confirmation.
    }
    setCopiedReview(true);
    notify("success", "Review copied", "Paste it on Google.");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopiedReview(false), 2000);
  };

  const trackRedirect = (platform?: string) =>
    track(reviewId(), "redirect", platform);

  const platformEntries = createMemo(() => {
    const links = business()?.reviewLinks;
    if (!links) return [] as [string, string][];
    // Links are navigated to automatically, and rows saved before the API
    // validated schemes may still hold `javascript:` URLs, so re-check here.
    return Object.entries(links).flatMap(([key, value]) => {
      if (key === CUSTOM_LABEL_KEY) return [];
      const url = httpUrl(value);
      return url ? [[key, url] as [string, string]] : [];
    });
  });

  const googleUrl = () =>
    httpUrl(business()?.reviewLink) ??
    (business()?.placeId
      ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(business()?.placeId ?? "")}`
      : null);

  /** Google first when configured, then the rest in stored order. */
  const orderedPlatforms = createMemo(() => {
    const entries = platformEntries();
    const google = googleUrl();
    const nonGoogle = entries.filter(([slug]) => slug !== "google");
    if (google) return [["google", google] as [string, string], ...nonGoogle];
    return entries;
  });

  const primaryRedirect = () =>
    orderedPlatforms()[0]?.[1] ?? "https://search.google.com/local/writereview";

  // Spec: focus moves to the success heading on submit.
  createEffect(() => {
    if (submitted()) successHeadingRef?.focus();
  });

  const pageTitle = () =>
    submitted()
      ? `Thanks for reviewing ${business()?.name || "us"}`
      : business()?.name
        ? `Review ${business()?.name}`
        : "Leave a Review";

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Meta name="description" content="Leave a review for this business." />
      <AppToaster />

      <div class="hero-gradient flex min-h-dvh flex-col items-center bg-background px-4 py-8 sm:py-12">
        <Show
          when={!error()}
          fallback={
            <div class="e1-enter w-full max-w-120 rounded-soft border border-border bg-card p-8 text-center shadow-md sm:p-10">
              <div class="mx-auto mb-5 grid size-14 place-items-center rounded-soft bg-destructive-muted">
                <AlertTriangle
                  class="size-7 text-destructive"
                  aria-hidden="true"
                />
              </div>
              <p class="tnum text-sm font-medium uppercase tracking-wide text-muted-foreground">
                404
              </p>
              <h1 class="mt-1 font-heading text-2xl font-semibold text-foreground">
                {error()}
              </h1>
              <p class="mt-2 text-sm text-muted-foreground">
                Check the link and try again, or find the business below.
              </p>
              <div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href="/"
                  class="inline-flex h-14 items-center justify-center rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                >
                  Home
                </a>
                <a
                  href="/marketplace"
                  class="inline-flex h-14 items-center justify-center rounded-control border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Find a business
                </a>
              </div>
            </div>
          }
        >
          <Show
            when={!submitted()}
            fallback={
              <div class="e1-enter w-full max-w-120 rounded-soft border border-border bg-card p-8 text-center shadow-md sm:p-10">
                <div class="mx-auto mb-5 flex justify-center">
                  <SubmittedCheck />
                </div>
                <h1
                  ref={successHeadingRef}
                  tabIndex={-1}
                  class="font-heading text-2xl font-semibold text-foreground focus:outline-none"
                >
                  Thanks for your review
                </h1>
                <p class="mt-2 text-base text-muted-foreground">
                  Your review for {business()?.name ?? "this business"} is
                  saved. One last step — post it on Google so others can see it.
                </p>
                <Show when={!stayed()}>
                  <div class="mx-auto mt-6 max-w-sm">
                    <RedirectCountdown
                      seconds={5}
                      targetLabel="Google"
                      onRedirect={() => {
                        trackRedirect("google");
                        window.location.href = primaryRedirect();
                      }}
                      onStay={() => setStayed(true)}
                    />
                  </div>
                </Show>
                <div class="mt-6 grid gap-3">
                  <Show
                    when={orderedPlatforms().length > 0}
                    fallback={
                      <p class="text-sm text-muted-foreground">
                        No redirect configured — you're all done. Thank you!
                      </p>
                    }
                  >
                    <For each={orderedPlatforms()}>
                      {([slug, redirectUrl]) => {
                        const label = getPlatformLabel(
                          slug,
                          business()?.reviewLinks ?? {},
                        );
                        const color =
                          getPlatformBySlug(slug)?.color ?? "#5b21b6";
                        return (
                          <a
                            href={redirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackRedirect(slug)}
                            class="inline-flex h-14 items-center justify-center gap-2 rounded-control px-6 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                            style={{ "background-color": color }}
                          >
                            <ExternalLink class="size-5" aria-hidden="true" />
                            Post on {label}
                          </a>
                        );
                      }}
                    </For>
                  </Show>
                  <button
                    type="button"
                    onClick={copyMyReview}
                    aria-live="polite"
                    class="inline-flex h-14 items-center justify-center gap-2 rounded-control border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Show
                      when={copiedReview()}
                      fallback={<Copy class="size-5" aria-hidden="true" />}
                    >
                      <Check class="size-5 text-success" aria-hidden="true" />
                    </Show>
                    {copiedReview()
                      ? "Copied — paste it on Google"
                      : "Copy my review"}
                  </button>
                </div>
              </div>
            }
          >
            {/* DS §6: single column, max 480px, Soft layer (20px radius). */}
            <div class="flex w-full max-w-120 flex-col gap-4">
              {/* Business header — skeleton holds layout while loading. */}
              <Show
                when={!loading() || business()}
                fallback={
                  <div
                    class="rounded-soft border border-border bg-card p-6 shadow-md"
                    aria-hidden="true"
                  >
                    <div class="flex flex-col items-center gap-4">
                      <Skeleton class="size-20 rounded-soft" />
                      <Skeleton class="h-7 w-3/4" />
                      <Skeleton class="h-4 w-1/2" />
                    </div>
                  </div>
                }
              >
                <Show when={business()}>
                  <header class="e1-enter rounded-soft border border-border bg-card p-6 text-center shadow-md">
                    <Show
                      when={business()?.logo}
                      fallback={
                        <div
                          class="mx-auto grid size-20 place-items-center rounded-soft bg-linear-to-br from-primary/10 to-purple/10 font-heading text-3xl font-semibold text-primary"
                          aria-hidden="true"
                        >
                          {business()?.name?.charAt(0) || "?"}
                        </div>
                      }
                    >
                      <img
                        src={business()!.logo!}
                        alt={`${business()?.name} logo`}
                        class="mx-auto size-20 rounded-soft object-cover shadow-md"
                      />
                    </Show>
                    <h1 class="mt-3 font-heading text-2xl font-semibold text-foreground">
                      {business()?.name ?? "Leave a Review"}
                    </h1>
                    <div class="mt-2 grid justify-items-center gap-1 text-sm text-muted-foreground">
                      <Show when={business()?.address}>
                        <p class="flex items-center gap-1.5">
                          <MapPin
                            class="size-4 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                          {business()?.address}
                        </p>
                      </Show>
                      <Show when={business()?.phone}>
                        <p class="flex items-center gap-1.5">
                          <Phone
                            class="size-4 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                          {business()?.phone}
                        </p>
                      </Show>
                    </div>
                    <p class="mt-3 text-base font-medium text-foreground">
                      How was your visit?
                    </p>
                    <p class="mt-0.5 text-sm text-muted-foreground">
                      Takes less than a minute.
                    </p>
                  </header>
                </Show>
              </Show>

              <Show
                when={!business() && !loading()}
                fallback={
                  <form
                    aria-label="Leave a review"
                    class="rounded-soft border border-border bg-card p-6 shadow-md"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitReview();
                    }}
                  >
                    {/* Star Rating Select — calm, instant, no bounce. */}
                    <fieldset>
                      <legend class="sr-only">
                        How would you rate your visit? Required.
                      </legend>
                      <RatingGroup.Root
                        value={rating()}
                        onValueChange={(details) =>
                          setRating(details.value as Rating)
                        }
                        count={5}
                      >
                        <div class="flex items-center justify-between gap-3">
                          <RatingGroup.Label class="text-base font-medium text-foreground">
                            Your rating
                          </RatingGroup.Label>
                          <Show when={rating() > 0}>
                            <span
                              class="tnum inline-flex items-center gap-1 text-base font-medium text-star-text"
                              aria-live="polite"
                            >
                              {rating()}.0
                              <Star
                                class="size-4 text-star"
                                fill="currentColor"
                                aria-hidden="true"
                              />
                            </span>
                          </Show>
                        </div>
                        <RatingGroup.Control class="mt-2 flex items-center justify-between">
                          <RatingGroup.Context>
                            {(api) => (
                              <For each={api().items}>
                                {(item) => (
                                  <RatingGroup.Item
                                    index={item}
                                    aria-label={`${item} star${item === 1 ? "" : "s"}`}
                                    class="inline-flex size-12 items-center justify-center rounded-control transition-colors duration-75 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                                  >
                                    <RatingGroup.ItemContext>
                                      {(itemState) => (
                                        <Star
                                          class="size-8 text-star"
                                          fill={
                                            itemState().highlighted
                                              ? "currentColor"
                                              : "none"
                                          }
                                          aria-hidden="true"
                                        />
                                      )}
                                    </RatingGroup.ItemContext>
                                  </RatingGroup.Item>
                                )}
                              </For>
                            )}
                          </RatingGroup.Context>
                          <RatingGroup.HiddenInput />
                        </RatingGroup.Control>
                      </RatingGroup.Root>
                    </fieldset>

                    <Field.Root class="mt-5">
                      <Field.Label class="text-base font-medium text-foreground">
                        Tell others about your visit
                      </Field.Label>
                      <Field.Textarea
                        id="public-review-text"
                        value={text()}
                        onInput={(e) =>
                          setText((e.target as HTMLTextAreaElement).value)
                        }
                        placeholder="What did you like? What could be better?"
                        rows={4}
                        aria-describedby={
                          formError() ? "public-review-error" : undefined
                        }
                        class="mt-2 w-full resize-y rounded-control border border-input bg-background px-4 py-3.5 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </Field.Root>

                    <Field.Root class="mt-4">
                      <Field.Label class="text-base font-medium text-foreground">
                        Your name{" "}
                        <span class="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Field.Label>
                      <Field.Input
                        type="text"
                        value={visitorName()}
                        onInput={(e) =>
                          setVisitorName((e.target as HTMLInputElement).value)
                        }
                        placeholder="How should we attribute this review?"
                        class="mt-2 h-14 w-full rounded-control border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </Field.Root>

                    {/* AI Draft Reveal — customer-initiated, clearly labelled. */}
                    <section
                      aria-labelledby="ai-help-heading"
                      aria-busy={aiLoading()}
                      class="mt-5"
                    >
                      <button
                        type="button"
                        onClick={fetchSuggestions}
                        disabled={aiLoading() || cooldownSecs() > 0}
                        class="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-base font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Show
                          when={!aiLoading()}
                          fallback={
                            <LoaderCircle
                              class="size-5 animate-spin"
                              aria-hidden="true"
                            />
                          }
                        >
                          <Sparkles class="size-5" aria-hidden="true" />
                        </Show>
                        {aiLoading()
                          ? "Writing drafts…"
                          : cooldownSecs() > 0
                            ? `Try again in ${cooldownSecs()}s`
                            : "Help me write it"}
                      </button>

                      <Show when={aiLoading()}>
                        <div class="mt-3 grid gap-3" role="status">
                          <span class="sr-only">Writing drafts…</span>
                          <For each={[0, 1, 2]}>
                            {() => (
                              <div class="skeleton h-24 rounded-card border border-border bg-muted" />
                            )}
                          </For>
                        </div>
                      </Show>

                      <Show when={!aiLoading() && suggestions().length > 0}>
                        <h2
                          id="ai-help-heading"
                          class="mt-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground"
                        >
                          AI drafts
                          <span class="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning">
                            AI draft · edit before posting
                          </span>
                        </h2>
                        <ul class="mt-3 grid gap-3" aria-live="polite">
                          <For each={suggestions()}>
                            {(suggestion, i) => (
                              <li
                                class="e4-card-enter"
                                style={{ "animation-delay": `${i() * 60}ms` }}
                              >
                                <div
                                  class="rounded-card border bg-background p-4 transition-colors"
                                  classList={{
                                    "border-primary":
                                      pickedId() === suggestion.id,
                                    "border-border hover:border-primary/60":
                                      pickedId() !== suggestion.id,
                                  }}
                                  style={
                                    pickedId() !== null &&
                                    pickedId() !== suggestion.id
                                      ? { opacity: "0.6" }
                                      : {}
                                  }
                                >
                                  <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-secondary">
                                    <MessageSquare
                                      class="size-3.5"
                                      aria-hidden="true"
                                    />
                                    {suggestion.tone}
                                  </p>
                                  <p class="mt-1.5 text-base leading-6 text-foreground">
                                    {suggestion.text}
                                  </p>
                                  <button
                                    type="button"
                                    aria-pressed={pickedId() === suggestion.id}
                                    onClick={() => applySuggestion(suggestion)}
                                    class="mt-3 inline-flex h-11 items-center gap-1.5 rounded-control bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                                  >
                                    <Check class="size-4" aria-hidden="true" />
                                    {pickedId() === suggestion.id
                                      ? "Applied — edit above"
                                      : "Use this version"}
                                  </button>
                                </div>
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                      <Show when={aiError()}>
                        <p role="alert" class="mt-3 text-sm text-destructive">
                          {aiError()}
                        </p>
                      </Show>
                    </section>

                    <Show when={formError()}>
                      <div
                        id="public-review-error"
                        role="alert"
                        class="mt-4 grid gap-3 rounded-card border border-destructive/25 bg-destructive-muted p-4"
                      >
                        <p class="text-sm text-destructive">{formError()}</p>
                        <Show when={claimExpired()}>
                          <button
                            type="button"
                            onClick={refreshClaim}
                            disabled={refreshingClaim()}
                            class="inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
                          >
                            {refreshingClaim()
                              ? "Preparing…"
                              : "Continue — start fresh"}
                          </button>
                        </Show>
                      </div>
                    </Show>

                    {/* Sticky primary on mobile; static on desktop. */}
                    <div class="sticky bottom-4 mt-5 sm:static sm:bottom-auto">
                      <button
                        type="submit"
                        disabled={submitting()}
                        class="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Show
                          when={!submitting()}
                          fallback={
                            <LoaderCircle
                              class="size-5 animate-spin"
                              aria-hidden="true"
                            />
                          }
                        >
                          <Send class="size-5" aria-hidden="true" />
                        </Show>
                        {submitting() ? "Submitting…" : "Submit review"}
                      </button>
                    </div>
                    <p class="mt-3 text-center text-xs text-muted-foreground/70">
                      You'll review your feedback before it's posted anywhere.
                    </p>
                  </form>
                }
              >
                <div class="e1-enter text-center">
                  <h1 class="font-heading text-2xl font-semibold text-foreground">
                    Leave a Review
                  </h1>
                  <p class="mt-2 text-base text-muted-foreground">
                    Share your experience below
                  </p>
                </div>
              </Show>

              <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                Powered by{" "}
                <InlineCombinationMark class="h-3.5 w-auto text-muted-foreground/60" />
              </p>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
}
