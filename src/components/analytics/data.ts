import { api } from "~/components/onboarding/ui";
import { getPlatformLabel } from "~/features/settings/review-platforms";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── API shape ───────────────────────────────────────────────────────────

/** One shared review link, as GET /api/reviews/analytics returns it. */
export type LinkRow = {
  id: string;
  /** First 60 characters of the suggested text, already truncated server-side. */
  text: string;
  rating: number;
  reviewerName: string | null;
  visits: number;
  reviews: number;
  qrScans: number;
  redirects: number;
  aiCopies: number;
  platformRedirects: Record<string, number>;
  createdAt: string;
};

export type AnalyticsData = {
  totalVisits: number;
  totalReviews: number;
  totalQrScans: number;
  totalRedirects: number;
  totalAiCopies: number;
  totalPlatformRedirects: Record<string, number>;
  totalLinks: number;
  reviews: LinkRow[];
};

export async function loadCampaigns(): Promise<AnalyticsData> {
  const res = await api<AnalyticsData>("/api/reviews/analytics");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load analytics");
  const data = res.data as AnalyticsData;
  return { ...data, reviews: data.reviews ?? [] };
}

// ─── Range and sort: both live in the URL so a view can be shared ────────

export type Range = "7" | "30" | "90" | "all";
export type SortKey = "created" | "visits" | "reviews" | "redirects" | "rate";
export type SortDir = "asc" | "desc";

export type View = { range: Range; sort: SortKey; dir: SortDir };

export const DEFAULT_VIEW: View = {
  range: "30",
  sort: "created",
  dir: "desc",
};

export const RANGE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

export const RANGE_LABELS: Record<Range, string> = {
  "7": "the last 7 days",
  "30": "the last 30 days",
  "90": "the last 90 days",
  all: "all time",
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function viewFrom(params: SearchParams): View {
  return {
    range: pick(
      one(params.range),
      ["7", "30", "90", "all"],
      DEFAULT_VIEW.range,
    ),
    sort: pick(
      one(params.sort),
      ["created", "visits", "reviews", "redirects", "rate"],
      DEFAULT_VIEW.sort,
    ),
    dir: pick(one(params.dir), ["asc", "desc"], DEFAULT_VIEW.dir),
  };
}

/** Defaults are dropped so the plain /marketing/analytics link stays clean. */
export function viewParams(v: Partial<View>) {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(v) as Array<keyof View>) {
    out[key] = v[key] === DEFAULT_VIEW[key] ? undefined : v[key];
  }
  return out;
}

/** Links created inside the range; "all" keeps every link. */
export function inRange(rows: LinkRow[], range: Range, now = Date.now()) {
  if (range === "all") return rows;
  const since = now - Number(range) * DAY_MS;
  return rows.filter((r) => new Date(r.createdAt).getTime() >= since);
}

// ─── Totals and funnel ───────────────────────────────────────────────────

export type Totals = {
  links: number;
  visits: number;
  reviews: number;
  redirects: number;
  qrScans: number;
  aiCopies: number;
};

export function totalsOf(rows: LinkRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      links: t.links + 1,
      visits: t.visits + r.visits,
      reviews: t.reviews + r.reviews,
      redirects: t.redirects + r.redirects,
      qrScans: t.qrScans + r.qrScans,
      aiCopies: t.aiCopies + r.aiCopies,
    }),
    { links: 0, visits: 0, reviews: 0, redirects: 0, qrScans: 0, aiCopies: 0 },
  );
}

export type FunnelStage = {
  key: "visits" | "reviews" | "redirects";
  label: string;
  hint: string;
  value: number;
  /** Share of the first stage, 0–100; the first stage is always 100. */
  ofFirst: number;
  /** Share of the stage above, 0–100; null for the first stage. */
  ofPrev: number | null;
  /** People who stopped here instead of reaching the next stage. */
  dropOff: number | null;
};

const STAGES = [
  {
    key: "visits",
    label: "Opened the page",
    hint: "Scanned the QR code or followed the link.",
  },
  {
    key: "reviews",
    label: "Wrote a review",
    hint: "Picked a rating and continued.",
  },
  {
    key: "redirects",
    label: "Went to a platform",
    hint: "Tapped through to Google, JustDial or another platform.",
  },
] as const;

const share = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/**
 * Visits → reviews → redirects. The three counts come from separate track
 * calls, so a later stage can in principle exceed an earlier one (a customer
 * who reopens the page). Percentages are clamped; the raw counts never are.
 */
export function funnelOf(t: Totals): FunnelStage[] {
  const values = {
    visits: t.visits,
    reviews: t.reviews,
    redirects: t.redirects,
  };
  return STAGES.map((stage, i) => {
    const value = values[stage.key];
    const prev = i === 0 ? null : values[STAGES[i - 1].key];
    const next = i === STAGES.length - 1 ? null : values[STAGES[i + 1].key];
    return {
      ...stage,
      value,
      ofFirst:
        i === 0 ? (value > 0 ? 100 : 0) : Math.min(100, share(value, t.visits)),
      ofPrev: prev === null ? null : Math.min(100, share(value, prev)),
      dropOff: next === null ? null : Math.max(0, value - next),
    };
  });
}

/** Share of visits that ended in a written review, 0–100. */
export const conversionRate = (row: { visits: number; reviews: number }) =>
  row.visits === 0
    ? 0
    : Math.min(100, Math.round((row.reviews / row.visits) * 100));

// ─── Platform breakdown ──────────────────────────────────────────────────

export type PlatformRow = {
  slug: string;
  label: string;
  count: number;
  /** Share of all redirects in the range, 0–100. */
  share: number;
};

export function platformRows(rows: LinkRow[]): PlatformRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const [slug, n] of Object.entries(row.platformRedirects ?? {})) {
      if (typeof n !== "number" || n <= 0) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + n);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      label: getPlatformLabel(slug, {}),
      count,
      share: share(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// ─── Table ───────────────────────────────────────────────────────────────

export const SORT_COLUMNS: ReadonlyArray<{
  key: SortKey;
  label: string;
  /** Counts and dates start at the largest value. */
  defaultDir: SortDir;
}> = [
  { key: "created", label: "Created", defaultDir: "desc" },
  { key: "visits", label: "Visits", defaultDir: "desc" },
  { key: "reviews", label: "Reviews", defaultDir: "desc" },
  { key: "redirects", label: "Redirects", defaultDir: "desc" },
  { key: "rate", label: "Conversion", defaultDir: "desc" },
];

const sortValue = (row: LinkRow, key: SortKey) => {
  switch (key) {
    case "created":
      return new Date(row.createdAt).getTime();
    case "rate":
      return conversionRate(row);
    default:
      return row[key];
  }
};

export function sortRows(rows: LinkRow[], sort: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  // Ties fall back to newest first, so the order never shuffles between renders.
  return [...rows].sort(
    (a, b) =>
      sign * (sortValue(a, sort) - sortValue(b, sort)) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** How a link is named in the table: the customer it was made for, else its text. */
export function linkTitle(row: LinkRow) {
  const name = row.reviewerName?.trim();
  if (name) return `For ${name}`;
  return row.text.trim() || "Review request";
}
