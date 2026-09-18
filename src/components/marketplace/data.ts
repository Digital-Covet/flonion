import { api } from "~/components/onboarding/ui";
import type { PartnersResult, SortKey } from "~/types/marketplace";
import { SORT_OPTIONS } from "~/types/marketplace";

/**
 * Marketplace view state and fetching.
 *
 * Types come from `~/types/marketplace`, never from `~/lib/partners-query`:
 * that module imports Prisma, and a value import from here would drag the
 * query compiler into the browser bundle.
 */

export type { Partner, PartnersResult } from "~/types/marketplace";
export { SORT_OPTIONS };

/** Cards drawn while the first page loads; matches the lg grid (3 × 2). */
export const SKELETON_CARDS = 6;

/** `GET /api/marketplace/partners` caches for 60s (`~/lib/partners-query`). */
export const CACHE_TTL_MS = 60_000;

export type RatingFilter = "any" | "4.5" | "4" | "3";

export const RATING_OPTIONS = [
  { value: "any", label: "Any rating" },
  { value: "4.5", label: "4.5 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "3", label: "3.0 and up" },
] as const satisfies ReadonlyArray<{ value: RatingFilter; label: string }>;

export type MarketplaceView = {
  search: string;
  categories: string[];
  rating: RatingFilter;
  sort: SortKey;
  page: number;
};

export const DEFAULT_VIEW: MarketplaceView = {
  search: "",
  categories: [],
  rating: "any",
  sort: "rating",
  page: 1,
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

/**
 * The whole view lives in the URL so a filtered marketplace can be shared or
 * reloaded. Categories are comma-joined in the page URL (the API takes them as
 * repeated `category` params, which `partnersPath` expands); no category name
 * contains a comma.
 */
export function viewFrom(params: SearchParams): MarketplaceView {
  const page = Number(one(params.page));

  return {
    search: one(params.search)?.trim() ?? "",
    categories: (one(params.category) ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    rating: pick(
      one(params.minRating),
      RATING_OPTIONS.map((o) => o.value),
      DEFAULT_VIEW.rating,
    ),
    sort: pick(
      one(params.sort),
      SORT_OPTIONS.map((o) => o.value),
      DEFAULT_VIEW.sort,
    ),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Defaults are dropped so a plain /marketplace link stays clean. */
export function viewParams(view: MarketplaceView) {
  return {
    search: view.search || undefined,
    category: view.categories.length ? view.categories.join(",") : undefined,
    minRating: view.rating === "any" ? undefined : view.rating,
    sort: view.sort === DEFAULT_VIEW.sort ? undefined : view.sort,
    page: view.page > 1 ? String(view.page) : undefined,
  };
}

export function partnersPath(view: MarketplaceView): string {
  const params = new URLSearchParams();
  for (const category of view.categories) params.append("category", category);
  if (view.search) params.set("search", view.search);
  if (view.rating !== "any") params.set("minRating", view.rating);
  params.set("sort", view.sort);
  if (view.page > 1) params.set("page", String(view.page));
  return `/api/marketplace/partners?${params.toString()}`;
}

/** Filters the owner actively set; sort and page aren't filters. */
export function activeFilterCount(view: MarketplaceView): number {
  return (
    view.categories.length +
    (view.search ? 1 : 0) +
    (view.rating === "any" ? 0 : 1)
  );
}

export function pageCount(result: PartnersResult): number {
  return Math.max(1, Math.ceil(result.totalCount / result.pageSize));
}

export type Loaded = { result: PartnersResult; loadedAt: number };

export async function loadPartners(view: MarketplaceView): Promise<Loaded> {
  const res = await api<PartnersResult>(partnersPath(view));
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load partners");

  const result = res.data as PartnersResult;
  return {
    result: { ...result, partners: result.partners ?? [] },
    loadedAt: Date.now(),
  };
}

/** Ids of the partners this user has favourited. */
export async function loadFavorites(): Promise<ReadonlySet<string>> {
  const res = await api<{ favorites: string[] }>("/api/marketplace/favorites");
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load favourites");
  return new Set(res.data.favorites ?? []);
}

/** Toggles server-side and reports the state the server settled on. */
export async function toggleFavorite(businessId: string): Promise<boolean> {
  const res = await api<{ favorited: boolean }>("/api/marketplace/favorites", {
    method: "POST",
    body: { businessId },
  });
  if (!res.ok) throw new Error(res.data.error ?? "Failed to update favourite");
  return Boolean(res.data.favorited);
}

/**
 * How fresh the list is. The API answers from a 60s cache, so "just now"
 * covers the window in which a refetch would return the same rows anyway.
 */
export function freshnessLabel(loadedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - loadedAt) / 1000));
  if (seconds < 60) return "Updated just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

/** "9 partners" / "1 partner" — counts read as words, numbers stay tabular. */
export function countLabel(total: number): string {
  return total === 1 ? "partner" : "partners";
}
