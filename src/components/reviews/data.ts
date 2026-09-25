import type { SearchParams } from "@solidjs/router";
import {
  type Sentiment,
  sentimentOf,
  stars,
} from "~/components/dashboard/data";
import type { SentimentAnalysis } from "~/types/ai";
import type { GoogleReview } from "~/types/google";

// ─── Filters (kept in the URL so a filtered inbox can be shared or reloaded) ─

export type StatusFilter = "needs-reply" | "replied" | "all";
export type DateFilter = "any" | "7" | "30" | "90";

export type InboxFilters = {
  status: StatusFilter;
  rating: "any" | "1" | "2" | "3" | "4" | "5";
  sentiment: "any" | Sentiment;
  date: DateFilter;
};

export const DEFAULT_FILTERS: InboxFilters = {
  status: "needs-reply",
  rating: "any",
  sentiment: "any",
  date: "any",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function filtersFrom(params: SearchParams): InboxFilters {
  return {
    status: pick(
      one(params.status),
      ["needs-reply", "replied", "all"],
      DEFAULT_FILTERS.status,
    ),
    rating: pick(
      one(params.rating),
      ["any", "1", "2", "3", "4", "5"],
      DEFAULT_FILTERS.rating,
    ),
    sentiment: pick(
      one(params.sentiment),
      ["any", "positive", "mixed", "negative"],
      DEFAULT_FILTERS.sentiment,
    ),
    date: pick(
      one(params.date),
      ["any", "7", "30", "90"],
      DEFAULT_FILTERS.date,
    ),
  };
}

/** Defaults are dropped from the URL so the plain inbox link stays clean. */
export function filterParams(f: Partial<InboxFilters>) {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(f) as Array<keyof InboxFilters>) {
    out[key] = f[key] === DEFAULT_FILTERS[key] ? undefined : f[key];
  }
  return out;
}

/** Status is its own control; this counts only the secondary filters. */
export function activeFilterCount(f: InboxFilters) {
  return (["rating", "sentiment", "date"] as const).filter(
    (k) => f[k] !== DEFAULT_FILTERS[k],
  ).length;
}

export function matchesStatus(review: GoogleReview, status: StatusFilter) {
  if (status === "needs-reply") return !review.reviewReply;
  if (status === "replied") return Boolean(review.reviewReply);
  return true;
}

export function applyFilters(
  reviews: GoogleReview[],
  f: InboxFilters,
  now = Date.now(),
): GoogleReview[] {
  const since = f.date === "any" ? 0 : now - Number(f.date) * 86_400_000;
  return reviews
    .filter(
      (r) =>
        matchesStatus(r, f.status) &&
        (f.rating === "any" || stars(r) === Number(f.rating)) &&
        (f.sentiment === "any" || sentimentOf(r) === f.sentiment) &&
        new Date(r.createTime).getTime() >= since,
    )
    .sort(
      (a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
    );
}

export const reviewerName = (r: GoogleReview) =>
  r.reviewer.isAnonymous
    ? "Anonymous"
    : r.reviewer.displayName || "Google user";

// ─── "Draft copied" marks ────────────────────────────────────────────────
// Replies are posted on Google, not here, so copying is the last step Flonion
// sees. The mark is a per-browser convenience and never claims "Replied".

const COPIED_KEY = "flonion:inbox-copied";
const COPIED_LIMIT = 500;

export function readCopied(): string[] {
  try {
    const raw = localStorage.getItem(COPIED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeCopied(ids: string[]) {
  try {
    localStorage.setItem(COPIED_KEY, JSON.stringify(ids.slice(-COPIED_LIMIT)));
  } catch {}
}

// ─── Reply drafts ────────────────────────────────────────────────────────

export type Tone = "professional" | "friendly" | "formal";

export const TONES: ReadonlyArray<{ value: Tone; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
];

export type DraftResult =
  | { kind: "ok"; draft: string; sentiment: SentimentAnalysis }
  | { kind: "rate-limited"; retryAt: number }
  | { kind: "error"; message: string };

export async function requestDraft(
  review: GoogleReview,
  tone: Tone,
): Promise<DraftResult> {
  try {
    const res = await fetch("/api/ai/draft-reply", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: review.comment ?? "",
        starRating: stars(review),
        reviewerName: review.reviewer.isAnonymous
          ? undefined
          : review.reviewer.displayName,
        tone,
      }),
    });
    if (res.status === 429) {
      const seconds = Number(res.headers.get("Retry-After")) || 60;
      return { kind: "rate-limited", retryAt: Date.now() + seconds * 1000 };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.draftReply !== "string") {
      return {
        kind: "error",
        message: data.error ?? "Could not generate a reply. Please try again.",
      };
    }
    return { kind: "ok", draft: data.draftReply, sentiment: data.sentiment };
  } catch {
    return {
      kind: "error",
      message:
        "We couldn't reach Flonion. Check your connection and try again.",
    };
  }
}
