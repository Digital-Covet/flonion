import { Dialog } from "@ark-ui/solid/dialog";
import { A } from "@solidjs/router";
import {
  IconArrowLeft,
  IconBrandGoogle,
  IconCheck,
  IconCircleCheck,
  IconClipboardCheck,
  IconCopy,
  IconExternalLink,
  IconFilterOff,
  IconInbox,
  IconMoodEmpty,
  IconMoodSad,
  IconMoodSmile,
  IconPlus,
  IconSparkles,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { focusRing, labelClass } from "~/components/auth/AuthShell";
import { relativeTime, stars } from "~/components/dashboard/data";
import { Skeleton } from "~/components/dashboard/ui";
import { SentimentLabel } from "~/components/dashboard/widgets";
import { AiMarker, OnionRings, RatingPill } from "~/components/landing/brand";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  SelectField,
  Spinner,
} from "~/components/onboarding/ui";
import {
  type InboxFilters,
  reviewerName,
  type StatusFilter,
  TONES,
  type Tone,
} from "~/components/reviews/data";
import { cn } from "~/lib/cn";
import type { SentimentAnalysis } from "~/types/ai";
import type { GoogleReview } from "~/types/google";

export const panelClass = "rounded-lg border border-border bg-surface";

/** Owners reply from the Business Profile manager; there's no posting API yet. */
export const GOOGLE_REPLY_URL = "https://business.google.com/reviews";

// ─── Segmented control (native radios, so it works with any input method) ─

export function Segmented<T extends string>(props: {
  legend: string;
  name: string;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  class?: string;
}) {
  return (
    <fieldset
      class={cn(
        "flex rounded-md border border-border-strong bg-surface p-1",
        props.class,
      )}
    >
      <legend class="sr-only">{props.legend}</legend>
      <For each={props.options}>
        {(option) => {
          const checked = () => props.value === option.value;
          return (
            <label
              class={cn(
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-colors duration-[var(--duration-fast)]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked()
                  ? "bg-primary text-primary-foreground"
                  : "text-text-muted hover:bg-primary-soft hover:text-text",
              )}
            >
              <input
                type="radio"
                class="sr-only"
                name={props.name}
                value={option.value}
                checked={checked()}
                onChange={() => props.onChange(option.value)}
              />
              {option.label}
              <Show when={option.count !== undefined}>
                <span
                  class={cn(
                    "font-mono text-xs tabular-nums",
                    checked() ? "opacity-90" : "text-text-muted",
                  )}
                >
                  {option.count}
                </span>
              </Show>
            </label>
          );
        }}
      </For>
    </fieldset>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { value: "any", label: "Any rating" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
] as const;

const SENTIMENT_OPTIONS = [
  { value: "any", label: "Any sentiment" },
  { value: "positive", label: "Positive" },
  { value: "mixed", label: "Mixed" },
  { value: "negative", label: "Negative" },
] as const;

const DATE_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

export function FilterBar(props: {
  filters: InboxFilters;
  counts: Record<StatusFilter, number>;
  activeCount: number;
  onChange: (next: Partial<InboxFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <Segmented
        legend="Reply status"
        name="inbox-status"
        class="lg:w-auto"
        value={props.filters.status}
        onChange={(status) => props.onChange({ status })}
        options={[
          {
            value: "needs-reply",
            label: "Needs reply",
            count: props.counts["needs-reply"],
          },
          { value: "replied", label: "Replied", count: props.counts.replied },
          { value: "all", label: "All", count: props.counts.all },
        ]}
      />

      <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:w-[620px]">
        <SelectField
          label="Rating"
          options={RATING_OPTIONS}
          value={props.filters.rating}
          onChange={(v) =>
            props.onChange({
              rating: (v || "any") as InboxFilters["rating"],
            })
          }
        />
        <SelectField
          label="Sentiment"
          options={SENTIMENT_OPTIONS}
          value={props.filters.sentiment}
          onChange={(v) =>
            props.onChange({
              sentiment: (v || "any") as InboxFilters["sentiment"],
            })
          }
        />
        <SelectField
          label="Date"
          options={DATE_OPTIONS}
          value={props.filters.date}
          onChange={(v) =>
            props.onChange({ date: (v || "any") as InboxFilters["date"] })
          }
        />
        <button
          type="button"
          onClick={() => props.onClear()}
          disabled={props.activeCount === 0}
          class={cn(
            btnSecondary,
            "px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
          )}
        >
          <IconFilterOff aria-hidden="true" class="size-4" />
          Clear
          <span class="sr-only"> filters</span>
        </button>
      </div>
    </div>
  );
}

// ─── Review list ─────────────────────────────────────────────────────────

function Avatar(props: { review: GoogleReview; class?: string }) {
  return (
    <span
      aria-hidden="true"
      class={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary",
        props.class,
      )}
    >
      {reviewerName(props.review).charAt(0).toUpperCase()}
    </span>
  );
}

function StatusChip(props: { review: GoogleReview; copied: boolean }) {
  return (
    <Switch>
      <Match when={props.review.reviewReply}>
        <span class="inline-flex items-center gap-1 text-xs font-medium text-success">
          <IconCircleCheck aria-hidden="true" class="size-3.5" />
          Replied
        </span>
      </Match>
      <Match when={props.copied}>
        <span class="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <IconClipboardCheck aria-hidden="true" class="size-3.5" />
          Draft copied
        </span>
      </Match>
    </Switch>
  );
}

/**
 * Listbox-style list: one tab stop, ↑/↓/Home/End move, Enter or Space opens.
 * Focus stays in the list so owners can triage with the keyboard alone.
 */
export function ReviewListbox(props: {
  reviews: GoogleReview[];
  selectedId?: string;
  copied: ReadonlySet<string>;
  onOpen: (id: string) => void;
}) {
  const [focusedId, setFocusedId] = createSignal<string>();
  const items = new Map<string, HTMLDivElement>();

  const tabStop = () => {
    const ids = props.reviews.map((r) => r.reviewId);
    for (const id of [focusedId(), props.selectedId]) {
      if (id && ids.includes(id)) return id;
    }
    return ids[0];
  };

  function move(from: string, delta: number | "start" | "end") {
    const ids = props.reviews.map((r) => r.reviewId);
    const i = ids.indexOf(from);
    const next =
      delta === "start"
        ? 0
        : delta === "end"
          ? ids.length - 1
          : Math.min(ids.length - 1, Math.max(0, i + delta));
    const id = ids[next];
    if (!id) return;
    setFocusedId(id);
    items.get(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent, id: string) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(id, 1),
      ArrowUp: () => move(id, -1),
      Home: () => move(id, "start"),
      End: () => move(id, "end"),
      Enter: () => props.onOpen(id),
      " ": () => props.onOpen(id),
    };
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  }

  return (
    <div role="listbox" aria-label="Reviews" class="divide-y divide-border">
      <For each={props.reviews}>
        {(review) => {
          const id = review.reviewId;
          const selected = () => props.selectedId === id;
          return (
            <div
              ref={(el) => {
                items.set(id, el);
                onCleanup(() => items.delete(id));
              }}
              id={`review-option-${id}`}
              role="option"
              aria-selected={selected()}
              tabIndex={tabStop() === id ? 0 : -1}
              onFocus={() => setFocusedId(id)}
              onClick={() => props.onOpen(id)}
              onKeyDown={(e) => onKeyDown(e, id)}
              class={cn(
                "relative flex cursor-pointer gap-3 px-4 py-3.5 outline-none transition-colors duration-[var(--duration-fast)]",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                selected()
                  ? "bg-primary-soft before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
                  : "hover:bg-background",
              )}
            >
              <Avatar review={review} />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate font-medium text-text">
                    {reviewerName(review)}
                  </p>
                  <time
                    datetime={review.createTime}
                    class="shrink-0 text-xs text-text-muted"
                  >
                    {relativeTime(review.createTime)}
                  </time>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <RatingPill rating={stars(review)} class="py-0.5 text-xs" />
                  <SentimentLabel review={review} />
                </div>
                <p class="mt-1.5 line-clamp-2 text-sm text-text-muted">
                  {review.comment || <em>Rating only, no written review</em>}
                </p>
                <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span class="inline-flex items-center gap-1 text-xs text-text-muted">
                    <IconBrandGoogle aria-hidden="true" class="size-3.5" />
                    Google
                  </span>
                  <StatusChip review={review} copied={props.copied.has(id)} />
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

export function ListSkeleton(props: { rows: number }) {
  return (
    <div aria-busy="true" class="divide-y divide-border">
      <span class="sr-only">Loading reviews…</span>
      {Array.from({ length: props.rows }, () => (
        <div class="flex gap-3 px-4 py-3.5">
          <Skeleton class="size-9 shrink-0 rounded-full" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton class="h-4 w-2/5" />
            <Skeleton class="h-5 w-32 opacity-80" />
            <Skeleton class="h-3.5 w-full opacity-70" />
            <Skeleton class="h-3.5 w-3/4 opacity-70" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty states ────────────────────────────────────────────────────────

export function EmptyState(props: {
  icon: typeof IconInbox;
  title: string;
  children?: JSX.Element;
  action?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        props.class,
      )}
    >
      <span class="relative grid size-24 place-items-center">
        <OnionRings rings={3} class="absolute inset-0 size-24" />
        <props.icon aria-hidden="true" class="size-8 text-primary" />
      </span>
      <h2 class="font-display text-lg font-semibold text-text">
        {props.title}
      </h2>
      <Show when={props.children}>
        <p class="max-w-[42ch] text-sm text-pretty text-text-muted">
          {props.children}
        </p>
      </Show>
      <Show when={props.action}>
        <div class="mt-1 flex flex-wrap justify-center gap-2">
          {props.action}
        </div>
      </Show>
    </div>
  );
}

export function NoReviewsYet() {
  return (
    <EmptyState
      icon={IconInbox}
      title="No reviews yet"
      action={
        <A href="/reviews/new" class={btnPrimary}>
          <IconPlus aria-hidden="true" class="size-5" />
          Create review request
        </A>
      }
    >
      Share your QR code with customers to start collecting reviews. New Google
      reviews show up here.
    </EmptyState>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const AI_SENTIMENT: Record<
  SentimentAnalysis["overallSentiment"],
  { label: string; icon: typeof IconMoodSmile; class: string }
> = {
  positive: {
    label: "Positive",
    icon: IconMoodSmile,
    class: "bg-success/10 text-success",
  },
  neutral: {
    label: "Neutral",
    icon: IconMoodEmpty,
    class: "bg-primary-soft text-text-muted",
  },
  mixed: {
    label: "Mixed",
    icon: IconMoodEmpty,
    class: "bg-warning/10 text-warning",
  },
  negative: {
    label: "Negative",
    icon: IconMoodSad,
    class: "bg-error/10 text-error",
  },
};

function SentimentSummary(props: {
  review: GoogleReview;
  analysis?: SentimentAnalysis;
}) {
  return (
    <section
      aria-labelledby="review-analysis"
      class="rounded-md border border-border bg-background p-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 id="review-analysis" class="text-sm font-medium text-text-muted">
          Sentiment
        </h3>
        <Show when={props.analysis}>
          <AiMarker label="AI analysis" />
        </Show>
      </div>
      <Show
        when={props.analysis}
        fallback={
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <SentimentLabel review={props.review} />
            <span class="text-xs text-text-muted">
              Based on the star rating. Draft a reply to see topics and intent.
            </span>
          </div>
        }
      >
        {(a) => {
          const s = () => AI_SENTIMENT[a().overallSentiment];
          const score = () => a().sentimentScore;
          return (
            <dl class="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <dt class="text-text-muted">Overall</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <span
                  class={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    s().class,
                  )}
                >
                  {(() => {
                    const Icon = s().icon;
                    return <Icon aria-hidden="true" class="size-3.5" />;
                  })()}
                  {s().label}
                </span>
                <span class="text-xs text-text-muted">
                  Score{" "}
                  <span class="font-mono text-text tabular-nums">
                    {score() > 0 ? "+" : ""}
                    {score().toFixed(1)}
                  </span>{" "}
                  on a −1 to +1 scale
                </span>
              </dd>
              <dt class="text-text-muted">Intent</dt>
              <dd class="text-text capitalize">{a().customerIntent}</dd>
              <Show when={a().keyTopics.length}>
                <dt class="self-start pt-0.5 text-text-muted">Topics</dt>
                <dd>
                  <ul class="flex flex-wrap gap-1.5">
                    <For each={a().keyTopics}>
                      {(topic) => (
                        <li class="rounded-sm bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                          {topic}
                        </li>
                      )}
                    </For>
                  </ul>
                </dd>
              </Show>
            </dl>
          );
        }}
      </Show>
    </section>
  );
}

export function ReviewDetail(props: {
  review: GoogleReview;
  analysis?: SentimentAnalysis;
  showBack: boolean;
  focusHeading: boolean;
  onBack: () => void;
  children: JSX.Element;
}) {
  return (
    <article
      aria-labelledby="review-detail-heading"
      class="flex flex-col gap-5 p-4 animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none md:p-5"
    >
      <Show when={props.showBack}>
        <button
          type="button"
          onClick={() => props.onBack()}
          class={cn(
            "-mt-1 -ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-2 text-sm font-medium text-primary",
            focusRing,
          )}
        >
          <IconArrowLeft aria-hidden="true" class="size-4" />
          All reviews
        </button>
      </Show>

      <header class="flex items-start gap-3">
        <Avatar review={props.review} class="size-11 text-base" />
        <div class="min-w-0 flex-1">
          <h2
            id="review-detail-heading"
            tabindex="-1"
            ref={(el) => {
              if (props.focusHeading) queueMicrotask(() => el.focus());
            }}
            class="font-display text-lg font-semibold text-text outline-none"
          >
            {reviewerName(props.review)}
          </h2>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
            <RatingPill rating={stars(props.review)} class="py-0.5" />
            <time datetime={props.review.createTime}>
              {fullDate(props.review.createTime)}
            </time>
            <span class="inline-flex items-center gap-1">
              <IconBrandGoogle aria-hidden="true" class="size-4" />
              Google
            </span>
          </div>
        </div>
      </header>

      <p class="text-base whitespace-pre-line text-pretty text-text">
        {props.review.comment || (
          <em class="text-text-muted">
            The customer left a star rating without a written review.
          </em>
        )}
      </p>

      <SentimentSummary review={props.review} analysis={props.analysis} />

      <Show when={props.review.reviewReply}>
        {(reply) => (
          <section
            aria-labelledby="existing-reply"
            class="rounded-md border-l-[3px] border-success bg-success/5 px-3 py-2.5"
          >
            <h3
              id="existing-reply"
              class="flex items-center gap-1.5 text-sm font-medium text-success"
            >
              <IconCircleCheck aria-hidden="true" class="size-4" />
              Your reply on Google
            </h3>
            <p class="mt-1 text-sm whitespace-pre-line text-text">
              {reply().comment}
            </p>
            <p class="mt-1 text-xs text-text-muted">
              Updated{" "}
              <time datetime={reply().updateTime}>
                {relativeTime(reply().updateTime)}
              </time>
            </p>
          </section>
        )}
      </Show>

      {props.children}
    </article>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-hidden="true" class="flex flex-col gap-5 p-5">
      <div class="flex gap-3">
        <Skeleton class="size-11 shrink-0 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-5 w-40" />
          <Skeleton class="h-5 w-56 opacity-80" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-2/3" />
      </div>
      <Skeleton class="h-20 w-full opacity-70" />
      <Skeleton class="h-40 w-full opacity-70" />
    </div>
  );
}

// ─── Reply composer ──────────────────────────────────────────────────────

export type DraftState = {
  tone: Tone;
  text: string;
  /** The last AI draft, to tell an untouched draft from an edited one. */
  aiText?: string;
  sentiment?: SentimentAnalysis;
  status: "idle" | "loading" | "error";
  error?: string;
  retryAt?: number;
  cooldownMs?: number;
};

export const EMPTY_DRAFT: DraftState = {
  tone: "professional",
  text: "",
  status: "idle",
};

export function formatWait(ms: number) {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function ReplyComposer(props: {
  review: GoogleReview;
  state: DraftState;
  textareaRef: (el: HTMLTextAreaElement) => void;
  onTone: (tone: Tone) => void;
  onText: (text: string) => void;
  onDraft: () => void;
  onCopied: () => void;
  announce: (message: string) => void;
}) {
  let textarea: HTMLTextAreaElement | undefined;
  const [now, setNow] = createSignal(Date.now());
  const [copied, setCopied] = createSignal(false);
  const [copyError, setCopyError] = createSignal(false);

  const waitMs = () => Math.max(0, (props.state.retryAt ?? 0) - now());
  const coolingDown = () => waitMs() > 0;
  const loading = () => props.state.status === "loading";
  const fromAi = () => Boolean(props.state.aiText);
  const edited = () => fromAi() && props.state.text !== props.state.aiText;
  const replied = () => Boolean(props.review.reviewReply);

  // Tick only while a cooldown is running.
  createEffect(() => {
    const until = props.state.retryAt;
    if (!until || until <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  // Auto-grow: height follows content, capped by max-h.
  createEffect(() => {
    props.state.text;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  });

  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));

  async function copy() {
    const text = props.state.text.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(false);
      setCopied(true);
      props.onCopied();
      props.announce("Reply copied");
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      textarea?.select();
    }
  }

  const draftLabel = () => {
    if (loading()) return "Writing…";
    if (props.state.text.trim()) return "Redraft reply";
    return "Draft reply";
  };

  return (
    <section
      aria-labelledby="reply-heading"
      class="flex flex-col gap-3 border-t border-border pt-5"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="reply-heading"
          class="font-display text-base font-semibold text-text"
        >
          {replied() ? "Write a new reply" : "Reply"}
        </h3>
        <span class="hidden text-xs text-text-muted lg:inline">
          Press{" "}
          <kbd class="rounded-sm border border-border-strong px-1 font-mono">
            R
          </kbd>{" "}
          to jump here
        </span>
      </div>

      <Segmented
        legend="Reply tone"
        name={`tone-${props.review.reviewId}`}
        options={TONES}
        value={props.state.tone}
        onChange={(tone) => props.onTone(tone)}
        class="sm:self-start"
      />

      <div class="flex flex-col gap-1.5">
        <div class="flex min-h-5 items-center justify-between gap-2">
          <label for={`reply-${props.review.reviewId}`} class={labelClass}>
            Your reply
          </label>
          <Show when={fromAi() && !loading()}>
            <AiMarker label={edited() ? "AI draft, edited" : "AI draft"} />
          </Show>
        </div>

        <Show
          when={!loading()}
          fallback={
            <div
              aria-hidden="true"
              class="flex min-h-[132px] flex-col gap-2 rounded-sm border border-border-strong bg-surface p-3"
            >
              <span class="flex items-center gap-1 text-xs font-medium text-primary">
                <IconSparkles class="size-3.5" />
                Writing a {props.state.tone} reply…
              </span>
              <Skeleton class="h-3.5 w-full" />
              <Skeleton class="h-3.5 w-11/12" />
              <Skeleton class="h-3.5 w-4/5" />
              <Skeleton class="h-3.5 w-2/5" />
            </div>
          }
        >
          <textarea
            id={`reply-${props.review.reviewId}`}
            ref={(el) => {
              textarea = el;
              props.textareaRef(el);
            }}
            rows={5}
            value={props.state.text}
            onInput={(e) => props.onText(e.currentTarget.value)}
            placeholder="Write a reply, or tap Draft reply for an AI starting point."
            class={cn(
              "block max-h-[50dvh] min-h-[132px] w-full resize-none rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-muted/80",
              "focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary",
              fromAi() &&
                "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-base)] motion-reduce:animate-in motion-reduce:fade-in-0 motion-reduce:duration-[var(--duration-instant)]",
            )}
          />
        </Show>
      </div>

      <Show when={props.state.status === "error" && props.state.error}>
        {(message) => (
          <Notice tone="error">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>{message()} Your text is unchanged.</span>
              <Show when={!coolingDown()}>
                <button
                  type="button"
                  onClick={() => props.onDraft()}
                  class={cn(btnSecondary, "min-h-9 px-3 text-sm")}
                >
                  Try again
                </button>
              </Show>
            </div>
          </Notice>
        )}
      </Show>

      <Show when={coolingDown()}>
        <Notice tone="warning">
          You've drafted a lot of replies recently. You can draft again in{" "}
          <span class="font-mono tabular-nums">{formatWait(waitMs())}</span>.
          Until then, you can still write or edit the reply yourself.
        </Notice>
      </Show>

      <Show when={copyError()}>
        <Notice tone="error">
          We couldn't copy automatically. The reply is selected, so copy it with
          your keyboard or long-press.
        </Notice>
      </Show>

      {/* Actions stay in thumb reach above the tab bar on phones. */}
      <div class="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-wrap gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <button
          type="button"
          onClick={() => props.onDraft()}
          disabled={loading() || coolingDown()}
          class={cn(
            btnPrimary,
            "flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:scale-100",
          )}
        >
          <Switch fallback={<IconSparkles aria-hidden="true" class="size-5" />}>
            <Match when={loading()}>
              <Spinner />
            </Match>
            <Match when={coolingDown()}>
              <span
                aria-hidden="true"
                class="size-5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2.5px))] motion-reduce:hidden"
                style={{
                  background: `conic-gradient(currentColor ${
                    (1 - waitMs() / (props.state.cooldownMs || 1)) * 360
                  }deg, color-mix(in srgb, currentColor 30%, transparent) 0)`,
                }}
              />
            </Match>
          </Switch>
          <Show when={coolingDown()} fallback={draftLabel()}>
            <span>
              Try again in{" "}
              <span class="font-mono tabular-nums">{formatWait(waitMs())}</span>
            </span>
          </Show>
        </button>

        <button
          type="button"
          onClick={copy}
          disabled={!props.state.text.trim() || loading()}
          class={cn(
            btnSecondary,
            "flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
          )}
        >
          <span class="relative grid size-5 place-items-center">
            <IconCopy
              aria-hidden="true"
              class={cn(
                "absolute size-5 transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
                copied() && "opacity-0",
              )}
            />
            <IconCheck
              aria-hidden="true"
              class={cn(
                "absolute size-5 text-success transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
                !copied() && "opacity-0",
              )}
            />
          </span>
          {copied() ? "Copied" : "Copy reply"}
        </button>

        <a
          href={GOOGLE_REPLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          class={cn(btnSecondary, "w-full sm:w-auto")}
        >
          <IconExternalLink aria-hidden="true" class="size-5" />
          Open on Google
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <p class="text-xs text-text-muted">
        Replies are posted on Google. Copy your reply, open Google, and paste it
        under this review.
      </p>
    </section>
  );
}

// ─── Keyboard shortcuts help ─────────────────────────────────────────────

const SHORTCUTS: Array<[string[], string]> = [
  [["↑", "↓"], "Move through the review list"],
  [["Enter"], "Open the focused review"],
  [["R"], "Jump to the reply box"],
  [["?"], "Show this list"],
];

export function ShortcutsDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Content class="w-full max-w-[400px] rounded-lg bg-surface p-6 text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95">
            <div class="flex items-start justify-between gap-4">
              <Dialog.Title class="font-display text-lg font-semibold">
                Keyboard shortcuts
              </Dialog.Title>
              <Dialog.CloseTrigger
                class={cn(
                  "-mt-2 -mr-2 grid size-11 place-items-center rounded-md text-text-muted hover:bg-primary-soft",
                  focusRing,
                )}
              >
                <IconX aria-hidden="true" class="size-5" />
                <span class="sr-only">Close</span>
              </Dialog.CloseTrigger>
            </div>
            <dl class="mt-4 flex flex-col divide-y divide-border">
              <For each={SHORTCUTS}>
                {([keys, description]) => (
                  <div class="flex items-center justify-between gap-4 py-2.5">
                    <dt class="text-sm text-text-muted">{description}</dt>
                    <dd class="flex gap-1">
                      <For each={keys}>
                        {(key) => (
                          <kbd class="min-w-7 rounded-sm border border-border-strong bg-background px-1.5 py-0.5 text-center font-mono text-xs">
                            {key}
                          </kbd>
                        )}
                      </For>
                    </dd>
                  </div>
                )}
              </For>
            </dl>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
