import { createAsync, useParams } from "@solidjs/router";
import { HttpHeader, HttpStatusCode } from "@solidjs/start";
import { IconExternalLink, IconSparkles } from "@tabler/icons-solidjs";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import {
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  textLink,
} from "~/components/auth/AuthShell";
import { PageMeta } from "~/components/meta/PageMeta";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import {
  CooldownRing,
  CopyButton,
  NAME_MAX,
  SuggestionCards,
  SuggestionSkeletons,
  TEXT_MAX,
} from "~/components/reviews/composer";
import {
  BusinessHeader,
  InactiveLink,
  PublicShell,
  publicCardClass,
  useOsColorScheme,
} from "~/components/reviews/public";
import { StarRating } from "~/components/reviews/StarRating";
import type { ReviewPlatformSlug } from "~/features/settings/review-platforms";
import { cn } from "~/lib/cn";
import { getCompanyReview, type PublicBusiness } from "~/lib/public-review";

// ─── Requests ────────────────────────────────────────────────────────────

type TrackType = "visit" | "review" | "redirect" | "ai_copy";

/** Beacon first so a redirect tap is still counted as the page unloads. */
function track(
  reviewId: string,
  type: TrackType,
  platform?: ReviewPlatformSlug,
) {
  const body = JSON.stringify({ reviewId, type, platform });
  try {
    if (
      navigator.sendBeacon?.(
        "/api/reviews/track",
        new Blob([body], { type: "application/json" }),
      )
    )
      return;
  } catch {}
  void fetch("/api/reviews/track", {
    method: "POST",
    keepalive: true,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}

/**
 * The visitor's own review row, created empty when the page opens and filled
 * in on Continue. The token proves they created it, so knowing an id is not
 * enough to overwrite someone else's review.
 */
type Claim = { reviewId: string; claimToken: string };

const claimKey = (businessId: string) => `flonion:review-claim:${businessId}`;
const visitKey = (businessId: string) => `flonion:review-visit:${businessId}`;

function readClaim(businessId: string): Claim | null {
  try {
    const raw = sessionStorage.getItem(claimKey(businessId));
    const value = raw ? JSON.parse(raw) : null;
    return typeof value?.reviewId === "string" &&
      typeof value?.claimToken === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeClaim(businessId: string, claim: Claim | null) {
  try {
    if (claim)
      sessionStorage.setItem(claimKey(businessId), JSON.stringify(claim));
    else sessionStorage.removeItem(claimKey(businessId));
  } catch {}
}

type CreateResult =
  | { kind: "created"; claim: Claim }
  /** Signed-in visitors hit the owner path of /api/reviews/share, which saves nothing. */
  | { kind: "signed-in" }
  | { kind: "error" };

/** Creates the empty row. Rating 0 because the visitor has not chosen yet. */
async function createRow(businessId: string): Promise<CreateResult> {
  try {
    const res = await fetch("/api/reviews/share", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, rating: 0, text: "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { kind: "error" };
    return typeof data.reviewId === "string" &&
      typeof data.claimToken === "string"
      ? {
          kind: "created",
          claim: { reviewId: data.reviewId, claimToken: data.claimToken },
        }
      : { kind: "signed-in" };
  } catch {
    return { kind: "error" };
  }
}

type SaveResult =
  | { kind: "saved" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

async function saveReview(input: {
  claim: Claim;
  rating: number;
  text: string;
  name: string;
}): Promise<SaveResult> {
  try {
    const res = await fetch("/api/reviews/share", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: input.claim.reviewId,
        claimToken: input.claim.claimToken,
        rating: input.rating,
        text: input.text,
        reviewerName: input.name.trim() || undefined,
      }),
    });
    if (res.ok) return { kind: "saved" };
    // The token lasts 24h, and the row can be gone if the owner deleted it.
    if (res.status === 403 || res.status === 404) return { kind: "expired" };
    if (res.status === 429) {
      return {
        kind: "error",
        message:
          "Too many reviews were sent from this network. Your text is still here, so try again in a little while.",
      };
    }
    return {
      kind: "error",
      message:
        "We couldn't save your review. Your text is still here, so try again.",
    };
  } catch {
    return {
      kind: "error",
      message:
        "We couldn't reach Flonion. Check your connection and try again. Your text is still here.",
    };
  }
}

type SuggestResult =
  | { kind: "ok"; suggestions: string[] }
  | { kind: "rate-limited" }
  | { kind: "error"; message: string };

async function suggestReview(input: {
  reviewId?: string;
  text: string;
  rating: number;
  keywords: string | null;
  businessName: string;
}): Promise<SuggestResult> {
  try {
    const res = await fetch("/api/ai/suggest-review", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: input.reviewId,
        draftText: input.text,
        starRating: input.rating,
        keywords: input.keywords || undefined,
        businessName: input.businessName,
      }),
    });
    if (res.status === 429) return { kind: "rate-limited" };
    const data = await res.json().catch(() => ({}));
    const list: string[] = Array.isArray(data.suggestedReviews)
      ? data.suggestedReviews.filter(
          (s: unknown): s is string => typeof s === "string" && s.trim() !== "",
        )
      : [];
    if (!res.ok || list.length === 0) {
      return {
        kind: "error",
        message:
          data.error ?? "We couldn't write suggestions. Please try again.",
      };
    }
    return { kind: "ok", suggestions: list.slice(0, 3) };
  } catch {
    return {
      kind: "error",
      message:
        "We couldn't reach Flonion. Check your connection and try again.",
    };
  }
}

const formatWait = (ms: number) => `${Math.max(1, Math.ceil(ms / 1000))}s`;

// ─── Page ────────────────────────────────────────────────────────────────

export default function CompanyReviewPage() {
  const params = useParams<{ username: string }>();
  // Waiting for the data before flushing keeps the title, the 404 status and
  // the business name (the LCP) in the first HTML.
  const review = createAsync(() => getCompanyReview(params.username), {
    deferStream: true,
  });

  onMount(() => onCleanup(useOsColorScheme()));

  return (
    <PublicShell>
      <Show when={review()} keyed>
        {(value) =>
          value.kind === "active" ? (
            <>
              {/* Identical for every anonymous visitor, so a shared cache may
                  serve it. `max-age=0` keeps it out of private browser caches,
                  where a stale copy would outlive a settings change. The
                  inactive branch below is deliberately left uncached: a link
                  that has just been activated must not stay 404 for a minute. */}
              <HttpHeader
                name="Cache-Control"
                value="public, max-age=0, s-maxage=60, stale-while-revalidate=300"
              />
              <PageMeta
                title={`Leave ${value.business.name} a review · Flonion`}
                description={`Share your experience with ${value.business.name}. No account or app needed.`}
                path={`/company/${params.username}/review`}
                noindex
              />
              <ReviewFlow business={value.business} />
            </>
          ) : (
            <>
              <HttpStatusCode code={404} />
              <PageMeta
                title="Review link not active · Flonion"
                path={`/company/${params.username}/review`}
                noindex
              />
              <InactiveLink />
            </>
          )
        }
      </Show>
    </PublicShell>
  );
}

type AiState = {
  status: "idle" | "loading" | "error";
  suggestions: string[];
  error?: string;
  retryAt?: number;
  cooldownMs?: number;
};

/** Short pause between requests so a double tap can't burn the hourly limit. */
const AI_COOLDOWN_MS = 10_000;
const AI_RATE_LIMIT_MS = 60_000;

/** The visitor's row: created when the page opens, saved on Continue. */
type RowState =
  | { kind: "creating" }
  | { kind: "ready"; claim: Claim }
  | { kind: "preview" }
  | { kind: "failed" };

function ReviewFlow(props: { business: PublicBusiness }) {
  const business = () => props.business;

  const [step, setStep] = createSignal<"write" | "done">("write");
  const [rating, setRating] = createSignal(0);
  const [ratingError, setRatingError] = createSignal<string>();
  const [name, setName] = createSignal("");
  const [text, setText] = createSignal("");
  const [textError, setTextError] = createSignal<string>();
  const [saving, setSaving] = createSignal(false);
  const [saveNotice, setSaveNotice] = createSignal<{
    tone: "error" | "warning";
    message: string;
  }>();
  const [preview, setPreview] = createSignal(false);

  let textarea: HTMLTextAreaElement | undefined;
  let firstStar: HTMLInputElement | undefined;
  let thanksHeading: HTMLHeadingElement | undefined;

  // ── Live region
  const [message, setMessage] = createSignal("");
  function announce(value: string) {
    setMessage("");
    queueMicrotask(() => setMessage(value));
  }

  // ── The visitor's row
  const [row, setRow] = createSignal<RowState>({ kind: "creating" });
  let pending: Promise<void> | undefined;
  let counted = false;

  function trackVisitOnce(reviewId: string) {
    // One visit per browser session, so refreshes don't inflate the funnel.
    try {
      if (sessionStorage.getItem(visitKey(business().id))) return;
      sessionStorage.setItem(visitKey(business().id), "1");
    } catch {}
    track(reviewId, "visit");
  }

  function start(): Promise<void> {
    if (pending) return pending;
    setRow({ kind: "creating" });
    pending = (async () => {
      const result = await createRow(business().id);
      if (result.kind === "created") {
        writeClaim(business().id, result.claim);
        setRow({ kind: "ready", claim: result.claim });
        trackVisitOnce(result.claim.reviewId);
      } else if (result.kind === "signed-in") {
        setRow({ kind: "preview" });
      } else {
        setRow({ kind: "failed" });
      }
      pending = undefined;
    })();
    return pending;
  }

  onMount(() => {
    // A refresh keeps the row the visitor already started this session.
    const existing = readClaim(business().id);
    if (existing) {
      setRow({ kind: "ready", claim: existing });
      trackVisitOnce(existing.reviewId);
      return;
    }
    void start();
  });

  const claimedId = () => {
    const r = row();
    return r.kind === "ready" ? r.claim.reviewId : undefined;
  };

  // Auto-grow the review box.
  createEffect(() => {
    text();
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  });

  // ── AI suggestions
  const [ai, setAi] = createSignal<AiState>({
    status: "idle",
    suggestions: [],
  });
  const [aiHint, setAiHint] = createSignal<string>();
  const [now, setNow] = createSignal(Date.now());
  const waitMs = () => Math.max(0, (ai().retryAt ?? 0) - now());
  const coolingDown = () => waitMs() > 0;

  createEffect(() => {
    const until = ai().retryAt;
    if (!until || until <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  async function helpMeWrite() {
    if (ai().status === "loading" || coolingDown()) return;
    if (!rating()) {
      setAiHint(
        "Pick a star rating first so the suggestions match your visit.",
      );
      firstStar?.focus();
      return;
    }
    if (!text().trim()) {
      setAiHint(
        "Write a few words first. We'll help you turn them into a review.",
      );
      textarea?.focus();
      return;
    }
    setAiHint(undefined);
    setAi((s) => ({ ...s, status: "loading", error: undefined }));
    announce("Writing suggestions…");

    const result = await suggestReview({
      reviewId: claimedId(),
      text: text(),
      rating: rating(),
      keywords: business().keywords,
      businessName: business().name,
    });

    if (result.kind === "ok") {
      setAi({
        status: "idle",
        suggestions: result.suggestions,
        retryAt: Date.now() + AI_COOLDOWN_MS,
        cooldownMs: AI_COOLDOWN_MS,
      });
      announce(
        `${result.suggestions.length} AI suggestions ready. Pick one to use or edit.`,
      );
    } else if (result.kind === "rate-limited") {
      setAi((s) => ({
        ...s,
        status: "idle",
        retryAt: Date.now() + AI_RATE_LIMIT_MS,
        cooldownMs: AI_RATE_LIMIT_MS,
      }));
      announce("Suggestion limit reached. Try again in a minute.");
    } else {
      setAi((s) => ({
        ...s,
        status: "error",
        error: result.message,
        retryAt: Date.now() + AI_COOLDOWN_MS,
        cooldownMs: AI_COOLDOWN_MS,
      }));
    }
  }

  function applySuggestion(value: string, edit: boolean) {
    setText(value);
    setTextError(undefined);
    const id = claimedId();
    if (!edit && id) track(id, "ai_copy");
    announce(
      edit
        ? "Suggestion added to the review box for editing."
        : "Suggestion added to your review.",
    );
    if (edit && textarea) {
      textarea.focus();
      textarea.setSelectionRange(value.length, value.length);
    }
  }

  // ── Continue
  async function submit(e: Event) {
    e.preventDefault();
    if (saving()) return;
    setSaveNotice(undefined);

    if (!rating()) {
      setRatingError("Pick a star rating to continue.");
      firstStar?.focus();
      return;
    }
    if (text().length > TEXT_MAX) {
      setTextError("Keep your review under 5,000 characters.");
      textarea?.focus();
      return;
    }

    setSaving(true);
    if (row().kind === "creating") await pending;
    if (row().kind === "failed") await start();

    const current = row();
    if (current.kind === "preview") {
      setSaving(false);
      finish(true);
      return;
    }
    if (current.kind !== "ready") {
      setSaving(false);
      setSaveNotice({
        tone: "error",
        message:
          "We couldn't reach Flonion. Check your connection and try again. Your text is still here.",
      });
      return;
    }

    const result = await saveReview({
      claim: current.claim,
      rating: rating(),
      text: text(),
      name: name(),
    });
    setSaving(false);

    if (result.kind === "saved") {
      if (!counted) {
        counted = true;
        track(current.claim.reviewId, "review");
      }
      finish(false);
      return;
    }
    if (result.kind === "expired") {
      writeClaim(business().id, null);
      void start();
      setSaveNotice({
        tone: "warning",
        message:
          "Your session expired. Your text is still here. Tap Continue to save again.",
      });
      return;
    }
    setSaveNotice({ tone: "error", message: result.message });
  }

  function finish(isPreview: boolean) {
    setPreview(isPreview);
    setStep("done");
    queueMicrotask(() => thanksHeading?.focus());
  }

  return (
    <>
      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-6">
        <BusinessHeader business={business()} />

        <Switch>
          <Match when={step() === "write"}>
            {/*
             * The rest of the form opens once a star is checked. Done in CSS
             * (`group-has-checked`) so it also works before hydration.
             */}
            <form
              novalidate
              onSubmit={submit}
              aria-label={`Review of ${business().name}`}
              class={cn(publicCardClass, "group/review flex flex-col gap-6")}
            >
              <StarRating
                legend="How was your visit?"
                value={rating()}
                onChange={(n) => {
                  setRating(n);
                  setRatingError(undefined);
                }}
                error={ratingError()}
                ref={(el) => {
                  firstStar = el;
                }}
              />

              <div class="hidden flex-col gap-6 border-t border-border pt-6 group-has-checked/review:flex motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-[var(--duration-base)]">
                {/* Review text, with AI help and the counter in its footer */}
                <div class="flex flex-col gap-2">
                  <label for="review-text" class={labelClass}>
                    Tell others about your visit
                  </label>
                  <div
                    class={cn(
                      "overflow-hidden rounded-md border border-border-strong bg-surface transition-colors duration-[var(--duration-fast)] focus-within:border-primary focus-within:outline-2 focus-within:outline-primary",
                      textError() && "border-error",
                    )}
                  >
                    <textarea
                      ref={textarea}
                      id="review-text"
                      name="text"
                      rows={4}
                      maxLength={TEXT_MAX}
                      placeholder="What did you like? What could be better?"
                      value={text()}
                      onInput={(e) => {
                        setText(e.currentTarget.value);
                        setTextError(undefined);
                        setAiHint(undefined);
                      }}
                      aria-invalid={textError() ? "true" : undefined}
                      aria-describedby={
                        textError() ? "review-text-error" : undefined
                      }
                      class="block min-h-28 w-full resize-none overflow-hidden bg-transparent px-3.5 pt-3 pb-2 text-base text-text outline-none placeholder:text-text-muted/80"
                    />
                    <div class="flex items-center justify-between gap-2 border-t border-border bg-background/60 py-1 pr-3 pl-1">
                      <button
                        type="button"
                        onClick={() => void helpMeWrite()}
                        disabled={ai().status === "loading" || coolingDown()}
                        aria-describedby={
                          aiHint() ? "review-ai-hint" : undefined
                        }
                        class={cn(
                          "inline-flex min-h-11 items-center gap-2 rounded-sm px-3 font-display text-sm font-semibold text-primary transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent",
                          focusRing,
                        )}
                      >
                        <Switch
                          fallback={
                            <>
                              <IconSparkles aria-hidden="true" class="size-4" />
                              Help me write
                            </>
                          }
                        >
                          <Match when={ai().status === "loading"}>
                            <Spinner class="size-4" />
                            Writing…
                          </Match>
                          <Match when={coolingDown()}>
                            <CooldownRing
                              waitMs={waitMs()}
                              totalMs={ai().cooldownMs ?? AI_COOLDOWN_MS}
                            />
                            Try again in{" "}
                            <span class="font-mono tabular-nums">
                              {formatWait(waitMs())}
                            </span>
                          </Match>
                        </Switch>
                      </button>
                      <span class="font-mono text-xs text-text-muted tabular-nums">
                        {text().length.toLocaleString("en-IN")}
                        <span class="sr-only"> of 5,000 characters</span>
                      </span>
                    </div>
                  </div>

                  <Show when={aiHint()}>
                    {(hint) => (
                      <p id="review-ai-hint" class="text-sm text-text-muted">
                        {hint()}
                      </p>
                    )}
                  </Show>
                  <FieldError id="review-text-error" message={textError()} />
                </div>

                <Show
                  when={
                    ai().status === "error" ||
                    ai().status === "loading" ||
                    ai().suggestions.length > 0
                  }
                >
                  <div class="-mt-2 flex flex-col gap-3">
                    <Show when={ai().status === "error" && ai().error}>
                      {(error) => <Notice tone="error">{error()}</Notice>}
                    </Show>
                    <Switch>
                      <Match when={ai().status === "loading"}>
                        <SuggestionSkeletons />
                      </Match>
                      <Match
                        when={ai().suggestions.length > 0 && ai().suggestions}
                      >
                        {(list) => (
                          <Show when={list()} keyed>
                            {(suggestions) => (
                              <SuggestionCards
                                suggestions={suggestions}
                                onUse={(v) => applySuggestion(v, false)}
                                onEdit={(v) => applySuggestion(v, true)}
                              />
                            )}
                          </Show>
                        )}
                      </Match>
                    </Switch>
                  </div>
                </Show>

                {/* Name */}
                <div class="flex flex-col gap-2">
                  <label for="review-name" class={labelClass}>
                    Your name{" "}
                    <span class="font-normal text-text-muted">(optional)</span>
                  </label>
                  <input
                    id="review-name"
                    name="name"
                    type="text"
                    autocomplete="name"
                    maxLength={NAME_MAX}
                    placeholder="How you'd like to appear"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    class={inputBase}
                  />
                </div>
              </div>

              <div class="hidden flex-col gap-3 group-has-checked/review:flex">
                <Show when={saveNotice()}>
                  {(n) => <Notice tone={n().tone}>{n().message}</Notice>}
                </Show>
                <button
                  type="submit"
                  aria-disabled={saving() ? "true" : undefined}
                  class={cn(
                    btnPrimary,
                    "min-h-12 w-full",
                    saving() && "cursor-progress opacity-80",
                  )}
                >
                  <Show when={saving()} fallback="Continue">
                    <Spinner />
                    Saving…
                  </Show>
                </button>
                <p class="text-center text-xs text-text-muted">
                  Shared with {business().name}.
                  <Show when={business().platforms.length > 0}>
                    {" "}
                    Next, you can post it on{" "}
                    {new Intl.ListFormat("en", { type: "disjunction" }).format(
                      business().platforms.map((p) => p.label),
                    )}
                    .
                  </Show>
                </p>
              </div>
            </form>
          </Match>

          <Match when={step() === "done"}>
            <ThankYou
              business={business()}
              text={text()}
              preview={preview()}
              reviewId={claimedId()}
              headingRef={(el) => {
                thanksHeading = el;
              }}
              announce={announce}
              onEdit={() => {
                setStep("write");
                queueMicrotask(() => textarea?.focus());
              }}
            />
          </Match>
        </Switch>
      </div>
    </>
  );
}

function ThankYou(props: {
  business: PublicBusiness;
  text: string;
  preview: boolean;
  reviewId?: string;
  headingRef: (el: HTMLHeadingElement) => void;
  announce: (message: string) => void;
  onEdit: () => void;
}) {
  const platforms = () => props.business.platforms;
  const [copyFailed, setCopyFailed] = createSignal(false);

  return (
    <section
      aria-labelledby="thanks-heading"
      class={cn(
        publicCardClass,
        "flex flex-col items-center gap-4 text-center",
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        class="size-16 text-success"
      >
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.3"
        />
        <path
          d="M15 24.5l6 6 12-13"
          pathLength="1"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="check-draw"
        />
      </svg>

      <h2
        ref={props.headingRef}
        id="thanks-heading"
        tabindex="-1"
        class="font-display text-xl font-semibold text-text outline-none"
      >
        <Show when={platforms().length > 0} fallback="Thanks for your review!">
          Thanks! One more step:
        </Show>
      </h2>

      <Show when={props.preview}>
        <Notice tone="info" class="text-left">
          You're signed in to Flonion, so this test review wasn't saved. Open
          the link in a private window to try it as a customer.
        </Notice>
      </Show>

      <Show
        when={platforms().length > 0}
        fallback={
          <p class="max-w-[36ch] text-base text-pretty text-text-muted">
            Your feedback has been shared with {props.business.name}.
          </p>
        }
      >
        <p class="max-w-[40ch] text-base text-pretty text-text-muted">
          <Show
            when={props.text.trim()}
            fallback="Post your review where others can find it."
          >
            Copy your review, then paste it on the site you choose so others can
            find it.
          </Show>
        </p>

        <div class="flex w-full flex-col gap-3">
          <Show when={props.text.trim()}>
            <CopyButton
              value={props.text}
              label="Copy my review"
              copiedMessage="Review copied"
              announce={props.announce}
              onFailed={() => setCopyFailed(true)}
              class="min-h-12 w-full"
            />
            <Show when={copyFailed()}>
              <Notice tone="warning" class="text-left">
                We couldn't copy automatically. Select your review below and
                copy it.
                <p class="mt-2 rounded-sm border border-border bg-background p-2 text-left whitespace-pre-wrap break-words select-all">
                  {props.text}
                </p>
              </Notice>
            </Show>
          </Show>

          {/* Equal-weight buttons, the same for every star rating. */}
          <ul aria-label="Post your review on" class="flex flex-col gap-3">
            <For each={platforms()}>
              {(p) => (
                <li>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (props.reviewId)
                        track(props.reviewId, "redirect", p.slug);
                    }}
                    class={cn(btnSecondary, "min-h-12 w-full")}
                  >
                    Post on {p.label}
                    <IconExternalLink aria-hidden="true" class="size-5" />
                    <span class="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <button
        type="button"
        onClick={() => props.onEdit()}
        class={cn("min-h-11 px-2 text-sm", textLink, focusRing)}
      >
        Edit my review
      </button>
    </section>
  );
}
