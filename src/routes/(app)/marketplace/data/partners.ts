import { isServer } from "solid-js/web";
import type { PartnersApiResponse, SortKey } from "~/types/marketplace";

export const RATING_OPTIONS = [3, 4, 5] as const;
export const RATING_MIN = 0;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;

export const RATING_FILTER_PRESETS: { min: number; max: number; label: string }[] = [
  { min: RATING_MIN, max: RATING_MAX, label: "Any" },
  { min: 3, max: RATING_MAX, label: "3.0+" },
  { min: 4, max: RATING_MAX, label: "4.0+" },
  { min: 4.5, max: RATING_MAX, label: "4.5+" },
  { min: RATING_MAX, max: RATING_MAX, label: "5.0" },
];

export const PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

interface ClientCacheEntry {
  data: PartnersApiResponse;
  expiresAt: number;
}

const clientCache = new Map<string, ClientCacheEntry>();
const CLIENT_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const CLIENT_CACHE_MAX_SIZE = 50;

function evictClientCache() {
  if (clientCache.size <= CLIENT_CACHE_MAX_SIZE) return;
  const now = Date.now();
  for (const [k, v] of clientCache) {
    if (now > v.expiresAt) clientCache.delete(k);
  }
  if (clientCache.size > CLIENT_CACHE_MAX_SIZE) {
    const firstKey = clientCache.keys().next().value;
    if (firstKey) clientCache.delete(firstKey);
  }
}

function buildQueryString(params: {
  search: string;
  categories: string[];
  ratingRange: [number, number];
  sort: SortKey;
  page: number;
  pageSize: number;
}): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  for (const cat of params.categories) {
    if (cat.trim()) query.append("category", cat.trim());
  }
  const [minRating, maxRating] = params.ratingRange;
  if (minRating > 0) query.set("minRating", String(minRating));
  if (maxRating < RATING_MAX) query.set("maxRating", String(maxRating));
  if (params.sort !== "rating") query.set("sort", params.sort);
  if (params.page > 1) query.set("page", String(params.page));
  query.set("pageSize", String(params.pageSize));
  return query.toString();
}

async function fetchFromServer(fullUrl: string): Promise<PartnersApiResponse> {
  const { GET } = await import("~/routes/api/marketplace/partners");
  const req = new Request(fullUrl);
  const res = await GET({ request: req } as never);
  const data = await res.json();
  return {
    partners: Array.isArray(data.partners) ? data.partners : [],
    totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
    page: typeof data.page === "number" ? data.page : 1,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : MAX_PAGE_SIZE,
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
}

async function fetchFromClient(path: string, signal?: AbortSignal): Promise<PartnersApiResponse> {
  const res = await fetch(path, { signal });
  if (!res.ok) {
    return { partners: [], totalCount: 0, page: 1, pageSize: MAX_PAGE_SIZE, categories: [] };
  }
  const data = await res.json();
  return {
    partners: Array.isArray(data.partners) ? data.partners : [],
    totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
    page: typeof data.page === "number" ? data.page : 1,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : MAX_PAGE_SIZE,
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
}

export async function fetchPartners(
  params: {
    search?: string;
    categories?: string[];
    ratingRange?: [number, number];
    sort?: SortKey;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<PartnersApiResponse> {
  const search = params.search?.trim() ?? "";
  const categories = params.categories ?? [];
  const ratingRange: [number, number] = params.ratingRange ?? [RATING_MIN, RATING_MAX];
  const sort = params.sort ?? "rating";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(params.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);

  const qs = buildQueryString({ search, categories, ratingRange, sort, page, pageSize });
  const cacheKey = `/api/marketplace/partners?${qs}`;

  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const result = isServer
      ? await fetchFromServer(`http://localhost${cacheKey}`)
      : await fetchFromClient(cacheKey, signal);

    evictClientCache();
    clientCache.set(cacheKey, { data: result, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { partners: [], totalCount: 0, page: 1, pageSize, categories: [] };
    }
    console.error("[marketplace/partners] query failed:", err);
    return { partners: [], totalCount: 0, page: 1, pageSize, categories: [] };
  }
}
