import {
  IconCheck,
  IconCopy,
  type IconDownload,
  IconPencil,
  IconSparkles,
  IconStar,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { BusinessInfo } from "~/components/app/context";
import { FieldError, focusRing, labelClass } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { AiMarker, RatingPill } from "~/components/landing/brand";
import { btnPrimary, btnSecondary } from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";
import { inlineQrLogo, qrPngDataUrl, qrSvgMarkup } from "~/lib/qr";

// ─── Limits (mirror /api/reviews/share) ──────────────────────────────────

export const NAME_MAX = 100;
export const TEXT_MAX = 5000;
export const KEYWORDS_MAX = 10;
const KEYWORD_LENGTH_MAX = 40;
/** The API caps the joined "a, b, c" string at 500 characters. */
export const KEYWORDS_CHARS_MAX = 500;

export const splitKeywords = (raw: string) =>
  raw
    .split(",")
    .map((k) => k.trim().replace(/\s+/g, " "))
    .filter(Boolean);

/** Customers open the link directly; the QR goes through /qr/:id so scans are counted. */
export const reviewLink = (id: string) =>
  `${window.location.origin}/review/${id}`;
export const qrLink = (id: string) => `${window.location.origin}/qr/${id}`;

// ─── Requests ────────────────────────────────────────────────────────────

export type CreateResult =
  | { kind: "ok"; reviewId: string }
  | { kind: "unauthorized" }
  | {
      kind: "invalid";
      field: "name" | "text" | "keywords" | null;
      message: string;
    }
  | { kind: "error"; message: string };

/** Creates a request when `id` is missing, otherwise saves over it. */
export async function saveRequest(input: {
  id?: string;
  customerName: string;
  text: string;
  keywords: string[];
}): Promise<CreateResult> {
  try {
    const res = await fetch("/api/reviews/share", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(input.id ? { id: input.id } : { fresh: true }),
        // The customer always picks the stars; nothing is pre-selected.
        rating: 0,
        text: input.text,
        reviewerName: input.customerName.trim() || undefined,
        keywords: input.keywords.join(", "),
      }),
    });
    if (res.status === 401) return { kind: "unauthorized" };
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.reviewId === "string") {
      return { kind: "ok", reviewId: data.reviewId };
    }
    const message: string = data.error ?? "";
    if (res.status === 400) {
      if (/reviewerName/.test(message))
        return {
          kind: "invalid",
          field: "name",
          message: "Keep the name under 100 characters.",
        };
      if (/keywords/.test(message))
        return {
          kind: "invalid",
          field: "keywords",
          message: "Use fewer or shorter keywords.",
        };
      if (/text/.test(message))
        return {
          kind: "invalid",
          field: "text",
          message: "Keep the suggestion under 5,000 characters.",
        };
    }
    return {
      kind: "error",
      message:
        "We couldn't save the review request. Your details are still here, so try again.",
    };
  } catch {
    return {
      kind: "error",
      message:
        "We couldn't reach Flonion. Check your connection and try again. Your details are still here.",
    };
  }
}

/**
 * The suggestion pipeline needs a rating to set the voice. Owners ask happy
 * and unhappy customers alike, so the composer uses a neutral-positive anchor;
 * the customer still picks their own stars and can rewrite every word.
 */
const SUGGESTION_RATING = 4;

export type SuggestResult =
  | { kind: "ok"; suggestions: string[] }
  | { kind: "rate-limited"; retryAt: number }
  | { kind: "error"; message: string };

export async function requestSuggestions(input: {
  text: string;
  keywords: string[];
  businessName?: string;
}): Promise<SuggestResult> {
  try {
    const res = await fetch("/api/ai/suggest-review", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftText: input.text,
        starRating: SUGGESTION_RATING,
        keywords: input.keywords.join(", ") || undefined,
        businessName: input.businessName || undefined,
      }),
    });
    if (res.status === 429) {
      const seconds = Number(res.headers.get("Retry-After")) || 60;
      return { kind: "rate-limited", retryAt: Date.now() + seconds * 1000 };
    }
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data.suggestedReviews)
      ? data.suggestedReviews.filter(
          (s: unknown): s is string => typeof s === "string" && s.trim() !== "",
        )
      : [];
    if (!res.ok || list.length === 0) {
      return {
        kind: "error",
        message:
          data.error ?? "Could not generate suggestions. Please try again.",
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

// ─── Keyword chips ───────────────────────────────────────────────────────

export function KeywordField(props: {
  id: string;
  keywords: string[];
  onChange: (keywords: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = createSignal("");
  let input: HTMLInputElement | undefined;

  function add(raw: string) {
    const next = [...props.keywords];
    for (const k of splitKeywords(raw)) {
      if (next.length >= KEYWORDS_MAX) break;
      if (!next.some((x) => x.toLowerCase() === k.toLowerCase()))
        next.push(k.slice(0, KEYWORD_LENGTH_MAX));
    }
    setDraft("");
    if (next.length !== props.keywords.length) props.onChange(next);
  }

  function remove(index: number) {
    props.onChange(props.keywords.filter((_, i) => i !== index));
    input?.focus();
  }

  const full = () => props.keywords.length >= KEYWORDS_MAX;

  return (
    <div class="flex flex-col gap-1.5">
      <label for={props.id} class={labelClass}>
        Keywords <span class="font-normal text-text-muted">(optional)</span>
      </label>
      <div
        class={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2 py-1.5 focus-within:border-primary focus-within:outline-2 focus-within:outline-primary",
          props.error && "border-error",
        )}
      >
        <ul class="contents" aria-label="Added keywords">
          <For each={props.keywords}>
            {(k, i) => (
              <li class="inline-flex items-center gap-1 rounded-sm bg-primary-soft py-1 pl-2.5 text-sm text-primary">
                {k}
                <button
                  type="button"
                  onClick={() => remove(i())}
                  aria-label={`Remove ${k}`}
                  class={cn(
                    "grid size-7 place-items-center rounded-sm hover:bg-primary/10",
                    focusRing,
                  )}
                >
                  <IconX aria-hidden="true" class="size-3.5" />
                </button>
              </li>
            )}
          </For>
        </ul>
        <input
          ref={input}
          id={props.id}
          type="text"
          enterkeyhint="enter"
          disabled={full()}
          placeholder={
            props.keywords.length ? "Add another" : "biryani, family dining"
          }
          value={draft()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            if (v.includes(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft());
            } else if (
              e.key === "Backspace" &&
              !draft() &&
              props.keywords.length
            ) {
              props.onChange(props.keywords.slice(0, -1));
            }
          }}
          onBlur={() => add(draft())}
          aria-invalid={props.error ? "true" : undefined}
          aria-describedby={`${props.id}-hint${props.error ? ` ${props.id}-error` : ""}`}
          class="min-h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-base text-text outline-none placeholder:text-text-muted/80 disabled:cursor-not-allowed"
        />
      </div>
      <p id={`${props.id}-hint`} class="text-sm text-text-muted">
        Pre-filled from your settings. AI suggestions mention them where they
        fit. <span class="font-mono tabular-nums">{props.keywords.length}</span>{" "}
        of <span class="font-mono tabular-nums">{KEYWORDS_MAX}</span>.
      </p>
      <FieldError id={`${props.id}-error`} message={props.error} />
    </div>
  );
}

// ─── AI suggestion cards ─────────────────────────────────────────────────

const STYLES = ["Simple", "Professional", "Casual"] as const;

export function SuggestionSkeletons() {
  return (
    <div aria-busy="true" class="grid gap-3">
      <span class="sr-only">Writing suggestions…</span>
      <For each={STYLES}>
        {() => (
          <div
            aria-hidden="true"
            class="flex min-h-[152px] flex-col gap-2 rounded-lg border border-border bg-surface p-4"
          >
            <Skeleton class="h-3.5 w-24" />
            <Skeleton class="mt-1 h-3.5 w-full" />
            <Skeleton class="h-3.5 w-11/12" />
            <Skeleton class="h-3.5 w-3/5" />
            <div class="mt-auto flex gap-2">
              <Skeleton class="h-9 w-24 rounded-md" />
              <Skeleton class="h-9 w-20 rounded-md" />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export function SuggestionCards(props: {
  suggestions: string[];
  onUse: (text: string) => void;
  onEdit: (text: string) => void;
}) {
  let first: HTMLElement | undefined;
  // Focus moves to the first card when drafts arrive.
  onMount(() => first?.focus());

  return (
    <ul aria-label="AI suggestions" class="grid gap-3">
      <For each={props.suggestions}>
        {(text, i) => (
          <li
            ref={(el) => {
              if (i() === 0) first = el;
            }}
            tabindex={i() === 0 ? -1 : undefined}
            aria-labelledby={`suggestion-${i()}`}
            style={{ "animation-delay": `${i() * 60}ms` }}
            class={cn(
              "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              "animate-in fade-in-0 [animation-fill-mode:backwards] motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-base)] motion-reduce:duration-[120ms] motion-reduce:[animation-delay:0ms]",
            )}
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span
                id={`suggestion-${i()}`}
                class="font-display text-sm font-semibold text-text"
              >
                {STYLES[i()] ?? `Option ${i() + 1}`}
              </span>
              <AiMarker />
            </div>
            <p class="text-base text-pretty text-text">{text}</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => props.onUse(text)}
                class={cn(btnSecondary, "min-h-11 px-3 text-sm")}
              >
                <IconCheck aria-hidden="true" class="size-4" />
                Use this
              </button>
              <button
                type="button"
                onClick={() => props.onEdit(text)}
                class={cn(
                  btnSecondary,
                  "min-h-11 border-transparent px-3 text-sm",
                )}
              >
                <IconPencil aria-hidden="true" class="size-4" />
                Edit
              </button>
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}

/** Conic ring that fills as a cooldown runs out (hidden under reduced motion). */
export function CooldownRing(props: { waitMs: number; totalMs: number }) {
  return (
    <span
      aria-hidden="true"
      class="size-5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2.5px))] motion-reduce:hidden"
      style={{
        background: `conic-gradient(currentColor ${
          (1 - props.waitMs / (props.totalMs || 1)) * 360
        }deg, color-mix(in srgb, currentColor 30%, transparent) 0)`,
      }}
    />
  );
}

// ─── Live preview (public review page on a phone frame) ──────────────────

export function PhonePreview(props: {
  business?: BusinessInfo;
  customerName: string;
  text: string;
}) {
  const name = () => props.business?.businessName || "Your business";
  const firstName = () => props.customerName.trim().split(/\s+/)[0];

  return (
    <div class="mx-auto w-full max-w-[340px] rounded-[2.25rem] border border-border-strong bg-background p-2.5 shadow-[0_12px_32px_rgb(0_0_0/0.10)]">
      {/* Decorative controls: `inert` keeps them out of the tab order and AT tree. */}
      <div
        inert
        class="relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.75rem] bg-surface"
      >
        <span
          aria-hidden="true"
          class="mx-auto mt-2 h-1.5 w-20 rounded-full bg-border"
        />

        <div class="flex flex-1 flex-col gap-5 px-5 pt-5 pb-4">
          <div class="flex flex-col items-center gap-2 text-center">
            <Show
              when={props.business}
              fallback={
                <>
                  <Skeleton class="size-12 rounded-md" />
                  <Skeleton class="h-5 w-36" />
                </>
              }
            >
              {(b) => (
                <>
                  <Show
                    when={b().logo}
                    fallback={
                      <span class="grid size-12 place-items-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground">
                        {name().charAt(0).toUpperCase()}
                      </span>
                    }
                  >
                    {(logo) => (
                      <img
                        src={logo()}
                        alt=""
                        class="size-12 rounded-md object-cover"
                      />
                    )}
                  </Show>
                  <p class="font-display text-lg font-semibold leading-tight text-text">
                    {name()}
                  </p>
                  <Show when={b().reviewCount > 0}>
                    <RatingPill
                      rating={b().rating}
                      count={b().reviewCount}
                      class="text-xs"
                    />
                  </Show>
                </>
              )}
            </Show>
          </div>

          <div class="flex flex-col items-center gap-2">
            <p class="font-display text-base font-semibold text-text">
              <Show when={firstName()}>{(n) => <>Hi {n()}, how</>}</Show>
              <Show when={!firstName()}>How</Show> was your visit?
            </p>
            <div class="flex gap-1">
              <For each={[1, 2, 3, 4, 5]}>
                {() => (
                  <span class="grid size-10 place-items-center">
                    <IconStar
                      class="size-8 stroke-accent"
                      fill="transparent"
                      stroke-width={1.5}
                    />
                  </span>
                )}
              </For>
            </div>
            <p class="text-xs text-text-muted">Tap a star to rate</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-text">
              Tell others about your visit
            </span>
            <div
              class={cn(
                "min-h-[112px] rounded-sm border border-border-strong px-3 py-2.5 text-sm whitespace-pre-wrap break-words",
                props.text.trim() ? "text-text" : "text-text-muted/80",
              )}
            >
              <span class="line-clamp-6">
                {props.text.trim() ||
                  "What did you like? What could be better?"}
              </span>
            </div>
          </div>

          <div class="mt-auto flex flex-col gap-2">
            <span class={cn(btnSecondary, "min-h-11 text-sm")}>
              <IconSparkles aria-hidden="true" class="size-4" />
              Help me write
            </span>
            <span class={cn(btnPrimary, "min-h-12 text-sm opacity-60")}>
              Continue
            </span>
          </div>
        </div>

        <p class="border-t border-border py-2.5 text-center text-xs text-text-muted">
          Powered by Flonion
        </p>
      </div>
    </div>
  );
}

// ─── QR prompt (printed materials only; the public page doesn't show it) ──

export const PROMPT_DEFAULT = "Scan to leave a review";
export const PROMPT_MAX = 60;
const PROMPT_KEY = "flonion:qr-prompt";

export function readPrompt(): string {
  try {
    return (
      localStorage.getItem(PROMPT_KEY)?.slice(0, PROMPT_MAX) || PROMPT_DEFAULT
    );
  } catch {
    return PROMPT_DEFAULT;
  }
}

export function writePrompt(value: string) {
  try {
    if (value.trim() && value.trim() !== PROMPT_DEFAULT)
      localStorage.setItem(PROMPT_KEY, value);
    else localStorage.removeItem(PROMPT_KEY);
  } catch {}
}

// ─── Share actions ───────────────────────────────────────────────────────

/** Icon swaps Copy → Check for 2s; no toast, the button is the feedback. */
export function CopyButton(props: {
  value: string;
  label: string;
  copiedMessage: string;
  announce: (message: string) => void;
  onFailed: () => void;
  class?: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      props.announce(props.copiedMessage);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onFailed();
    }
  }

  return (
    <button type="button" onClick={copy} class={cn(btnSecondary, props.class)}>
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
      {copied() ? "Copied" : props.label}
    </button>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function downloadQrPng(
  url: string,
  filename: string,
  logo?: string | null,
) {
  const dataUrl = await qrPngDataUrl(url, logo);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Opens a one-page printable sheet in a new window. Returns false when the
 * browser blocked the window, so the page can say so.
 */
export async function printQrSheet(input: {
  url: string;
  link: string;
  business: string;
  prompt: string;
  logo?: string | null;
}): Promise<boolean> {
  const win = window.open("", "_blank");
  if (!win) return false;
  // Inlined first: this window prints the moment it is written, so a logo still
  // being fetched over the network would be missing from the paper.
  const logo = await inlineQrLogo(input.logo);
  const svg = qrSvgMarkup(input.url, logo);
  const business = escapeHtml(input.business);
  win.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${business} · Review QR</title>
<style>
  @page { size: A5; margin: 16mm; }
  body { margin: 0; font-family: "Jost", ui-sans-serif, system-ui, sans-serif; color: #1C1917; }
  .sheet { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 24px; border: 1.5px dashed #8A837D; border-radius: 14px; max-width: 420px; margin: 24px auto; }
  h1 { font-size: 28px; margin: 0; }
  p { margin: 0; font-size: 18px; color: #57534E; }
  .qr { width: 280px; height: 280px; }
  .qr svg { width: 100%; height: 100%; }
  .link { font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; }
  .foot { font-size: 12px; }
</style></head>
<body><div class="sheet">
  <h1>${business}</h1>
  <p>${escapeHtml(input.prompt)}</p>
  <div class="qr">${svg}</div>
  <p class="link">${escapeHtml(input.link)}</p>
  <p class="foot">Powered by Flonion</p>
</div>
</body></html>`);
  win.document.close();
  // Printed from here rather than an inline script, which a strict CSP would block.
  win.focus();
  win.print();
  return true;
}

export function ActionButton(props: {
  icon: typeof IconDownload;
  onClick: () => void;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class={cn(btnSecondary, props.class)}
    >
      <props.icon aria-hidden="true" class="size-5" />
      {props.children}
    </button>
  );
}
