import type { BusinessInfo } from "~/components/app/context";
import {
  type GoogleData,
  type ListingData,
  profileChecks,
} from "~/components/dashboard/data";
import { splitKeywords } from "~/components/reviews/composer";
import type { GoogleLocation, GoogleReview } from "~/types/google";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Google's own manager, where photos, hours, posts and Q&A are edited. */
export const GOOGLE_PROFILE_URL = "https://business.google.com/";

// ─── Text helpers ────────────────────────────────────────────────────────

/** Lowercase, accents stripped, punctuation turned into single spaces. */
export function normText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whole-phrase match, so "spa" doesn't count inside "spacious". */
function mentions(text: string, phrase: string) {
  const p = normText(phrase);
  return p.length > 0 && ` ${normText(text)} `.includes(` ${p} `);
}

// ─── Review signals ──────────────────────────────────────────────────────

export type ReviewSignals = {
  averageRating: number;
  totalReviewCount: number;
  /** How many reviews the figures below were computed from. */
  loaded: number;
  last30Days: number;
  replied: number;
  unreplied: number;
  /** Share of loaded reviews with a reply, 0–100. */
  replyRate: number;
  /** Median days from review to reply; null when nothing is replied yet. */
  medianReplyDays: number | null;
};

export function reviewSignals(
  data: Extract<GoogleData, { kind: "ready" }>,
  now = Date.now(),
): ReviewSignals {
  const reviews = data.reviews;
  const replied = reviews.filter((r) => r.reviewReply);
  const waits = replied
    .map(
      (r) =>
        (new Date(r.reviewReply?.updateTime ?? r.createTime).getTime() -
          new Date(r.createTime).getTime()) /
        DAY_MS,
    )
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(waits.length / 2);
  const median =
    waits.length === 0
      ? null
      : waits.length % 2
        ? waits[mid]
        : (waits[mid - 1] + waits[mid]) / 2;

  return {
    averageRating: data.averageRating,
    totalReviewCount: data.totalReviewCount,
    loaded: reviews.length,
    last30Days: reviews.filter(
      (r) => now - new Date(r.createTime).getTime() <= 30 * DAY_MS,
    ).length,
    replied: replied.length,
    unreplied: reviews.length - replied.length,
    replyRate: reviews.length
      ? Math.round((replied.length / reviews.length) * 100)
      : 0,
    medianReplyDays: median,
  };
}

// ─── Keywords ────────────────────────────────────────────────────────────

export type KeywordRow = {
  keyword: string;
  inDescription: boolean;
  /** Number of loaded reviews that use the phrase. */
  reviewMentions: number;
};

export function keywordRows(
  business: BusinessInfo,
  reviews: GoogleReview[],
): KeywordRow[] {
  return splitKeywords(business.keywords).map((keyword) => ({
    keyword,
    inDescription: mentions(
      `${business.businessName} ${business.description}`,
      keyword,
    ),
    reviewMentions: reviews.filter((r) => mentions(r.comment ?? "", keyword))
      .length,
  }));
}

const STOPWORDS = new Set(
  (
    "the and for are but not you your was were with this that have has had " +
    "they them their very really just also too all any can will would " +
    "our out get got its it's his her she him who what when where which " +
    "from into onto than then there here been being more most much many " +
    "some such only own same other again ever even well good great nice " +
    "best better amazing awesome excellent place thank thanks visit " +
    "visited time times definitely highly recommend recommended one two " +
    "staff service experience loved love like went come came back"
  ).split(" "),
);

/**
 * Two-word phrases that several customers use on their own. Counted, not
 * generated, so they are shown as "from your reviews" rather than as AI.
 */
export function phrasesFromReviews(
  reviews: GoogleReview[],
  existing: string[],
  limit = 6,
): Array<{ phrase: string; reviews: number }> {
  const taken = existing.map(normText);
  const counts = new Map<string, number>();

  for (const review of reviews) {
    const words = normText(review.comment ?? "").split(" ");
    const seen = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i];
      const b = words[i + 1];
      if (a.length < 3 || b.length < 3) continue;
      if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
      if (/\d/.test(a) || /\d/.test(b)) continue;
      seen.add(`${a} ${b}`);
    }
    for (const phrase of seen) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return [...counts]
    .filter(
      ([phrase, n]) =>
        n >= 2 && !taken.some((k) => k.includes(phrase) || phrase.includes(k)),
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([phrase, n]) => ({ phrase, reviews: n }));
}

// ─── Google listing consistency (name, address, phone) ───────────────────

export type MatchStatus = "match" | "different" | "missing";

export type ListingRow = {
  id: "name" | "address" | "phone" | "verified";
  label: string;
  flonion: string;
  google: string;
  status: MatchStatus;
};

const phoneDigits = (v: string) => v.replace(/\D/g, "").slice(-10);

function tokens(v: string) {
  return new Set(
    normText(v)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function compareAddress(a: string, b: string): MatchStatus {
  if (!a.trim() || !b.trim()) return "missing";
  const postal = (v: string) => v.match(/\b\d{5,6}\b/)?.[0];
  const pa = postal(a);
  const pb = postal(b);
  if (pa && pb && pa !== pb) return "different";
  const ta = tokens(a);
  const tb = tokens(b);
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size === 0) return "different";
  const shared = [...small].filter((t) => large.has(t)).length;
  return shared / small.size >= 0.6 ? "match" : "different";
}

export function listingRows(
  business: BusinessInfo,
  location: GoogleLocation,
): ListingRow[] {
  const name = (a: string, b: string): MatchStatus => {
    const x = normText(a);
    const y = normText(b);
    if (!x || !y) return "missing";
    return x === y || x.includes(y) || y.includes(x) ? "match" : "different";
  };
  const phone = (a: string, b: string): MatchStatus => {
    const x = phoneDigits(a);
    const y = phoneDigits(b);
    if (!x || !y) return "missing";
    return x === y ? "match" : "different";
  };
  const verified = location.locationState.isGoogleVerified;

  return [
    {
      id: "name",
      label: "Business name",
      flonion: business.businessName,
      google: location.displayName,
      status: name(business.businessName, location.displayName),
    },
    {
      id: "address",
      label: "Address",
      flonion: business.address,
      google: location.address,
      status: compareAddress(business.address, location.address),
    },
    {
      id: "phone",
      label: "Phone",
      flonion: business.phone,
      google: location.primaryPhone,
      status: phone(business.phone, location.primaryPhone),
    },
    {
      id: "verified",
      label: "Verified on Google",
      flonion: "",
      google: verified ? "Verified" : "Not verified",
      status: verified ? "match" : "missing",
    },
  ];
}

// ─── Score ───────────────────────────────────────────────────────────────

export type CategoryId =
  | "profile"
  | "reviews"
  | "replies"
  | "listing"
  | "keywords";

export type Category = {
  id: CategoryId;
  label: string;
  /** 0–100, or null when the data isn't available (usually Google). */
  score: number | null;
  detail: string;
};

const WEIGHTS: Record<CategoryId, number> = {
  profile: 30,
  reviews: 25,
  replies: 15,
  listing: 15,
  keywords: 15,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function categories(input: {
  business: BusinessInfo;
  google: GoogleData | undefined;
  listing: ListingData | undefined;
}): Category[] {
  const { business, google, listing } = input;
  const ready = google?.kind === "ready" ? google : undefined;
  const signals = ready ? reviewSignals(ready) : undefined;

  const checks = profileChecks(
    business,
    google !== undefined && google.kind !== "disconnected",
  );
  const profile = checks.reduce((s, c) => s + (c.done ? c.weight : 0), 0);
  const missing = checks.filter((c) => !c.done).length;

  let reviews: number | null = null;
  if (signals) {
    const rating =
      signals.totalReviewCount === 0
        ? 0
        : signals.averageRating >= 4.5
          ? 40
          : signals.averageRating >= 4
            ? 32
            : signals.averageRating >= 3.5
              ? 20
              : 10;
    // log scale: 10 reviews ≈ 15, 100 reviews = 30.
    const volume = Math.min(
      30,
      (Math.log10(1 + signals.totalReviewCount) / 2) * 30,
    );
    const fresh =
      signals.last30Days >= 4
        ? 30
        : signals.last30Days >= 2
          ? 20
          : signals.last30Days === 1
            ? 10
            : 0;
    reviews = clamp(rating + volume + fresh);
  }

  const rows =
    listing?.kind === "ready" ? listingRows(business, listing.location) : [];
  const keywords = keywordRows(business, ready?.reviews ?? []);
  const inDescription = keywords.filter((k) => k.inDescription).length;
  const inReviews = keywords.filter((k) => k.reviewMentions > 0).length;
  const keywordScore = !keywords.length
    ? 0
    : ready?.reviews.length
      ? ((inDescription + inReviews) / (keywords.length * 2)) * 100
      : (inDescription / keywords.length) * 100;

  return [
    {
      id: "profile",
      label: "Profile completeness",
      score: clamp(profile),
      detail: missing
        ? `${missing} ${missing === 1 ? "detail" : "details"} missing`
        : "Every detail filled in",
    },
    {
      id: "reviews",
      label: "Reviews",
      score: reviews,
      detail: signals
        ? `${signals.last30Days} new in the last 30 days`
        : "Connect Google to score",
    },
    {
      id: "replies",
      label: "Replies",
      score: signals && signals.loaded > 0 ? signals.replyRate : null,
      detail: signals
        ? signals.loaded > 0
          ? `${signals.unreplied} waiting for a reply`
          : "No reviews to reply to yet"
        : "Connect Google to score",
    },
    {
      id: "listing",
      label: "Google listing match",
      score: rows.length
        ? clamp(
            (rows.filter((r) => r.status === "match").length / rows.length) *
              100,
          )
        : null,
      detail: rows.length
        ? `${rows.filter((r) => r.status === "match").length} of ${rows.length} checks match`
        : "Connect Google to score",
    },
    {
      id: "keywords",
      label: "Keywords",
      score: clamp(keywordScore),
      detail: keywords.length
        ? `${inDescription} of ${keywords.length} in your description`
        : "No keywords set",
    },
  ];
}

/** Weighted average over the categories that could be scored. */
export function overallScore(list: Category[]) {
  let total = 0;
  let weight = 0;
  for (const c of list) {
    if (c.score === null) continue;
    total += c.score * WEIGHTS[c.id];
    weight += WEIGHTS[c.id];
  }
  return weight ? Math.round(total / weight) : 0;
}

export const scoreTier = (score: number) =>
  score >= 80 ? "Strong" : score >= 50 ? "Good start" : "Needs work";

// ─── Actions ─────────────────────────────────────────────────────────────

export type Impact = "high" | "medium" | "low";

export type SeoAction = {
  id: string;
  title: string;
  why: string;
  impact: Impact;
  link?: { href: string; label: string; external?: boolean };
  done: boolean;
  /**
   * Happens outside Flonion (on Google), so Flonion can't see it: the owner
   * ticks it off, and the tick is kept in this browser.
   */
  manual?: boolean;
};

const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };

const googleLink = {
  href: GOOGLE_PROFILE_URL,
  label: "Open Google profile",
  external: true,
};

/** Steps on Google that affect local ranking but aren't exposed to Flonion. */
const MANUAL_ACTIONS: Array<Omit<SeoAction, "done">> = [
  {
    id: "google-photos",
    title: "Add at least 10 recent photos on Google",
    why: "Listings with photos get more requests for directions and calls.",
    impact: "high",
    link: googleLink,
    manual: true,
  },
  {
    id: "google-hours",
    title: "Check your opening hours, including holidays",
    why: "Wrong hours are the fastest way to lose a walk-in and earn a bad review.",
    impact: "high",
    link: googleLink,
    manual: true,
  },
  {
    id: "google-services",
    title: "List your products or services on Google",
    why: "Helps Google show you for specific searches, not just your name.",
    impact: "medium",
    link: googleLink,
    manual: true,
  },
  {
    id: "google-posts",
    title: "Post an update on Google this week",
    why: "Regular offers and news show customers the business is active.",
    impact: "medium",
    link: googleLink,
    manual: true,
  },
  {
    id: "google-qa",
    title: "Answer the questions on your Google profile",
    why: "Your answer is what the next customer with the same question reads.",
    impact: "low",
    link: googleLink,
    manual: true,
  },
];

export function seoActions(input: {
  business: BusinessInfo;
  google: GoogleData | undefined;
  listing: ListingData | undefined;
  ticked: ReadonlySet<string>;
}): SeoAction[] {
  const { business, google, listing, ticked } = input;
  const ready = google?.kind === "ready" ? google : undefined;
  const signals = ready ? reviewSignals(ready) : undefined;
  const actions: SeoAction[] = [];

  for (const check of profileChecks(
    business,
    google !== undefined && google.kind !== "disconnected",
  )) {
    actions.push({
      id: `profile-${check.label}`,
      title: check.done ? check.label : check.action,
      why:
        check.weight >= 20
          ? "Lets Flonion read your reviews and check your listing."
          : "Complete profiles are easier for customers and search engines to trust.",
      impact: check.weight >= 15 ? "high" : "medium",
      link: check.done ? undefined : { href: check.href, label: "Settings" },
      done: check.done,
    });
  }

  if (signals && signals.loaded > 0) {
    actions.push({
      id: "reply-reviews",
      title: signals.unreplied
        ? `Reply to ${signals.unreplied} ${signals.unreplied === 1 ? "review" : "reviews"}`
        : "Every loaded review has a reply",
      why: "Replies show customers, and Google, that someone is listening.",
      impact: signals.unreplied >= 3 ? "high" : "medium",
      link: signals.unreplied
        ? { href: "/reviews/inbox", label: "Open inbox" }
        : undefined,
      done: signals.unreplied === 0,
    });
  }

  if (signals) {
    actions.push({
      id: "fresh-reviews",
      title:
        signals.last30Days >= 2
          ? "Getting new reviews regularly"
          : "Ask for new reviews this month",
      why: "Recent reviews count for more than old ones in local results.",
      impact: "medium",
      link:
        signals.last30Days >= 2
          ? undefined
          : { href: "/reviews/new", label: "New request" },
      done: signals.last30Days >= 2,
    });
  }

  if (listing?.kind === "ready") {
    for (const row of listingRows(business, listing.location)) {
      if (row.id === "verified") {
        actions.push({
          id: "listing-verified",
          title:
            row.status === "match"
              ? "Listing verified on Google"
              : "Verify your listing on Google",
          why: "Unverified listings rank lower and can be edited by anyone.",
          impact: "high",
          link: row.status === "match" ? undefined : googleLink,
          done: row.status === "match",
        });
        continue;
      }
      actions.push({
        id: `listing-${row.id}`,
        title:
          row.status === "match"
            ? `${row.label} matches Google`
            : row.status === "missing"
              ? `Add your ${row.label.toLowerCase()} on both Flonion and Google`
              : `Make your ${row.label.toLowerCase()} match on Flonion and Google`,
        why: "The same name, address and phone everywhere helps Google trust the listing.",
        impact: "high",
        link:
          row.status === "match"
            ? undefined
            : { href: "/settings", label: "Settings" },
        done: row.status === "match",
      });
    }
  }

  const keywords = keywordRows(business, ready?.reviews ?? []);
  const absent = keywords.filter((k) => !k.inDescription);
  if (keywords.length) {
    actions.push({
      id: "keywords-description",
      title: absent.length
        ? `Mention “${absent[0].keyword}” in your description${absent.length > 1 ? ` (and ${absent.length - 1} more)` : ""}`
        : "Your description uses all your keywords",
      why: "Say what you offer in the words customers search with.",
      impact: "medium",
      link: absent.length
        ? { href: "/settings", label: "Settings" }
        : undefined,
      done: absent.length === 0,
    });
  }

  for (const action of MANUAL_ACTIONS) {
    actions.push({ ...action, done: ticked.has(action.id) });
  }

  return actions.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact],
  );
}

// ─── Manual ticks (per business, per browser) ────────────────────────────

const tickKey = (businessId: string) => `flonion:seo-done:${businessId}`;

export function readTicked(businessId: string): string[] {
  try {
    const raw = localStorage.getItem(tickKey(businessId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeTicked(businessId: string, ids: string[]) {
  try {
    localStorage.setItem(tickKey(businessId), JSON.stringify(ids));
  } catch {}
}
