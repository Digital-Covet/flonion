import type { AccessorWithLatest } from "@solidjs/router";
import { createSignal, onMount, type Resource } from "solid-js";
import type { BusinessInfo } from "~/components/app/context";
import { api } from "~/components/onboarding/ui";
import {
  type GoogleAccount,
  type GoogleLocation,
  type GoogleReview,
  type GoogleReviewsResponse,
  googleStarRatingToNumber,
} from "~/types/google";

/**
 * The business, but only once the browser has taken over.
 *
 * The loaders in this file fetch this app's own `/api/*` routes with a
 * relative URL, which has no base during SSR, and they need the browser's
 * cookies anyway. The app shell now resolves the business on the server, so
 * without this gate those resources would start during the server render and
 * fail. Routes drop this when they move to server-loaded queries.
 */
export function clientBusiness(
  business: AccessorWithLatest<BusinessInfo | undefined>,
): () => BusinessInfo | undefined {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  return () => (mounted() ? business.latest : undefined);
}

/** Value of a settled resource without ever triggering Suspense. */
export function settled<T>(r: Resource<T>): T | undefined {
  return r.state === "ready" || r.state === "refreshing" ? r.latest : undefined;
}

export const isLoading = (r: Resource<unknown>) =>
  r.state === "unresolved" || r.state === "pending";

// ─── Google reviews ──────────────────────────────────────────────────────

export type GoogleData =
  | { kind: "disconnected" }
  /** Connected, but no Google location matches the business's place id. */
  | { kind: "unmatched" }
  | {
      kind: "ready";
      reviews: GoogleReview[];
      averageRating: number;
      totalReviewCount: number;
      /** Present when Google has more reviews than this page returned. */
      nextPageToken?: string;
    };

type LocationMatch = {
  placeId: string;
  accountId: string;
  locationId: string;
  location: GoogleLocation;
};

type LocationsResponse = {
  accounts: Array<GoogleAccount & { locations: GoogleLocation[] }>;
};
type LocationsResult = Awaited<ReturnType<typeof fetchLocationsOnce>>;

const fetchLocationsOnce = () =>
  api<LocationsResponse>("/api/google/locations");

/** Pages that load reviews and the listing together share one lookup. */
let pendingLookup: Promise<LocationsResult> | null = null;

function fetchLocations(): Promise<LocationsResult> {
  pendingLookup ??= fetchLocationsOnce().finally(() => {
    pendingLookup = null;
  });
  return pendingLookup;
}

/**
 * The reviews endpoint is keyed by account + location, but a business stores
 * only its place id, so the match has to be resolved from the account walk.
 *
 * That walk is cached server-side (`src/server/google-cache.ts`), which is
 * where the cost actually lives. This used to keep its own copy in
 * `sessionStorage`; that was per tab, lost on a hard refresh, and — worse —
 * outlived a Google reconnect, so a disconnected owner kept resolving against
 * a grant that no longer existed.
 */
async function resolveLocation(placeId: string): Promise<LocationMatch | null> {
  const res = await fetchLocations();
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load locations");

  for (const account of res.data.accounts ?? []) {
    const location = account.locations.find((l) => l.placeId === placeId);
    if (!location) continue;
    const accountId = account.name.split("/").pop();
    const locationId = location.name.split("/").pop();
    if (!accountId || !locationId) continue;
    return { placeId, accountId, locationId, location };
  }
  return null;
}

export type ListingData =
  | { kind: "disconnected" }
  | { kind: "unmatched" }
  | { kind: "ready"; location: GoogleLocation };

/** The business's Google Business Profile listing, as Google shows it. */
export async function loadListing(
  business: BusinessInfo,
): Promise<ListingData> {
  const status = await api<{ connected: boolean }>("/api/google/status");
  if (!status.ok) throw new Error("Failed to check Google connection");
  if (!status.data.connected) return { kind: "disconnected" };
  if (!business.placeId) return { kind: "unmatched" };

  const match = await resolveLocation(business.placeId);
  if (!match) return { kind: "unmatched" };
  return { kind: "ready", location: match.location };
}

export function loadGoogle(business: BusinessInfo): Promise<GoogleData> {
  return loadGooglePage(business);
}

/** One page of Google reviews; pass the previous page's token to continue. */
export async function loadGooglePage(
  business: BusinessInfo,
  pageToken?: string,
): Promise<GoogleData> {
  const status = await api<{ connected: boolean }>("/api/google/status");
  if (!status.ok) throw new Error("Failed to check Google connection");
  if (!status.data.connected) return { kind: "disconnected" };
  if (!business.placeId) return { kind: "unmatched" };

  const location = await resolveLocation(business.placeId);
  if (!location) return { kind: "unmatched" };

  const params = new URLSearchParams({
    accountId: location.accountId,
    locationId: location.locationId,
    pageSize: "50",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await api<GoogleReviewsResponse>(`/api/google/reviews?${params}`);
  if (res.status === 401) return { kind: "disconnected" };
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load reviews");

  return {
    kind: "ready",
    reviews: res.data.reviews ?? [],
    averageRating: res.data.averageRating ?? 0,
    totalReviewCount: res.data.totalReviewCount ?? 0,
    nextPageToken: res.data.nextPageToken,
  };
}

export const stars = (review: GoogleReview) =>
  googleStarRatingToNumber(review.starRating);

export type Sentiment = "positive" | "mixed" | "negative";

/** Star-based sentiment; always shown with an icon and a word. */
export function sentimentOf(review: GoogleReview): Sentiment {
  const n = stars(review);
  if (n >= 4) return "positive";
  if (n === 3) return "mixed";
  return "negative";
}

// ─── Flonion review links ────────────────────────────────────────────────

export type Analytics = {
  totalVisits: number;
  totalReviews: number;
  totalQrScans: number;
  totalRedirects: number;
  totalLinks: number;
};

export async function loadAnalytics(): Promise<Analytics> {
  const res = await api<Analytics>("/api/reviews/analytics");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load analytics");
  return res.data as Analytics;
}

// ─── Tasks & meetings ────────────────────────────────────────────────────

export type Task = {
  id: string;
  title: string;
  column: "todo" | "in_progress" | "waiting" | "done";
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
};

export async function loadTasks(): Promise<Task[]> {
  const res = await api<Task[]>("/api/tasks");
  // Members without a business get 404: that's "no tasks", not an error.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Failed to load tasks");
  return Array.isArray(res.data) ? (res.data as Task[]) : [];
}

export type Meeting = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  direction: "incoming" | "outgoing";
  category: "team" | "partner";
  guestName: string | null;
  meetUri: string | null;
  slot: { date: string; startTime: string; endTime: string };
  business: { name: string } | null;
  requester: { name: string } | null;
};

export async function loadMeetings(): Promise<Meeting[]> {
  const res = await api<{ meetings: Meeting[] }>("/api/marketplace/meetings");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load meetings");
  return res.data.meetings ?? [];
}

/** Slot dates are stored as midnight UTC; the time is local wall-clock. */
export function meetingStart(m: Meeting): Date {
  const day = m.slot.date.slice(0, 10);
  return new Date(`${day}T${m.slot.startTime}`);
}

// ─── Profile score ───────────────────────────────────────────────────────

export type ProfileCheck = {
  label: string;
  action: string;
  href: string;
  weight: number;
  done: boolean;
};

/**
 * Completeness of the fields customers and search engines see. Weights favour
 * what most affects local search: the Google link, address and description.
 */
export function profileChecks(
  b: BusinessInfo,
  googleConnected: boolean,
): ProfileCheck[] {
  const platforms = Object.values(b.reviewLinks ?? {}).filter(Boolean);
  return [
    {
      label: "Google Business Profile connected",
      action: "Connect your Google Business Profile",
      href: "/settings",
      weight: 20,
      done: googleConnected && Boolean(b.placeId),
    },
    {
      label: "Address added",
      action: "Add your full address",
      href: "/settings",
      weight: 15,
      done: Boolean(b.address.trim()),
    },
    {
      label: "Description written",
      action: "Write a short business description",
      href: "/settings",
      weight: 15,
      done: b.description.trim().length >= 40,
    },
    {
      label: "Phone number added",
      action: "Add a phone number",
      href: "/settings",
      weight: 10,
      done: Boolean(b.phone.trim()),
    },
    {
      label: "Keywords set",
      action: "Add keywords customers search for",
      href: "/settings",
      weight: 10,
      done: Boolean(b.keywords.trim()),
    },
    {
      label: "Logo uploaded",
      action: "Upload your logo",
      href: "/settings",
      weight: 10,
      done: Boolean(b.logo),
    },
    {
      label: "Review platforms linked",
      action: "Link at least one review platform",
      href: "/settings",
      weight: 10,
      done: platforms.length > 0 || Boolean(b.reviewLink),
    },
    {
      label: "Sector chosen",
      action: "Choose your business sector",
      href: "/settings",
      weight: 10,
      done: Boolean(b.sector.trim()),
    },
  ];
}

// ─── Formatting ──────────────────────────────────────────────────────────

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
