import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import {
  MARKETPLACE_CATEGORIES,
  CATEGORY_KEYWORDS,
  matchBusinessToCategory,
} from "~/constants/categories";
import type { SortKey } from "~/types/marketplace";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 60;
const NEW_ARRIVAL_WINDOW_DAYS = 30;
const ALL_CATEGORIES = "All Categories";

const VALID_SORT_KEYS = new Set<SortKey>(["rating", "relevance", "alpha-asc", "alpha-desc"]);

export interface Partner {
  id: string;
  initial: string;
  name: string;
  username: string | null;
  logo: string | null;
  rating: number;
  reviewCount: number;
  description: string;
  category?: string;
  location: string | null;
  phone: string | null;
  tags: string[];
  isNew: boolean;
  buttonType: "meeting" | "request";
}

type BusinessRow = {
  id: string;
  name: string;
  description: string | null;
  sector: string | null;
  keywords: string | null;
  rating: number | null;
  reviewCount: number | null;
  logo: string | null;
  username: string | null;
  address: string | null;
  phone: string | null;
  createdAt: Date;
};

function splitKeywords(keywords: string | null): string[] {
  if (!keywords) return [];
  return keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function buildTags(business: BusinessRow): string[] {
  const tags = splitKeywords(business.keywords);

  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toPartner(business: BusinessRow, newArrivalCutoff: Date): Partner {
  const matchedCategory = matchBusinessToCategory(business.sector, business.keywords);

  return {
    id: business.id,
    initial: business.name.trim().charAt(0).toUpperCase() || "?",
    name: business.name,
    username: business.username,
    logo: business.logo,
    rating: business.rating ?? 0,
    reviewCount: business.reviewCount ?? 0,
    description: business.description ?? business.sector ?? "",
    category: matchedCategory ?? "Professional Services",
    location: business.address ?? null,
    phone: business.phone ?? null,
    tags: buildTags(business),
    isNew: business.createdAt >= newArrivalCutoff,
    buttonType: "meeting",
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setInCache(key: string, data: unknown, ttlMs: number = CACHE_TTL_MS) {
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
    if (cache.size > 500) cache.clear();
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function sortToOrderBy(sort: SortKey): Record<string, unknown>[] {
  switch (sort) {
    case "alpha-asc":
      return [{ name: "asc" }, { id: "asc" }];
    case "alpha-desc":
      return [{ name: "desc" }, { id: "asc" }];
    case "relevance":
      return [
        { reviewCount: { sort: "desc", nulls: "last" } },
        { rating: { sort: "desc", nulls: "last" } },
        { id: "asc" },
      ];
    case "rating":
    default:
      return [
        { rating: { sort: "desc", nulls: "last" } },
        { reviewCount: { sort: "desc", nulls: "last" } },
        { id: "asc" },
      ];
  }
}

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);

  // Categories: multi-value via getAll, trim, dedupe, drop ALL_CATEGORIES
  const categories = url.searchParams
    .getAll("category")
    .map((c) => c.trim())
    .filter((c) => c && c !== ALL_CATEGORIES);
  const uniqueCategories = [...new Set(categories)];

  const search = url.searchParams.get("search")?.trim() ?? "";
  const minRatingRaw = Number(url.searchParams.get("minRating"));
  const minRating = Number.isFinite(minRatingRaw) && minRatingRaw > 0 ? minRatingRaw : null;
  const maxRatingRaw = Number(url.searchParams.get("maxRating"));
  const maxRating = Number.isFinite(maxRatingRaw) && maxRatingRaw > 0 ? maxRatingRaw : null;
  const sortRaw = url.searchParams.get("sort")?.trim() as SortKey | null;
  const sort: SortKey = sortRaw && VALID_SORT_KEYS.has(sortRaw) ? sortRaw : "rating";
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(
    parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const cacheKey = `cat=${uniqueCategories.join("|")}&q=${search}&r=${minRating ?? ""}&rx=${maxRating ?? ""}&s=${sort}&p=${page}&ps=${pageSize}`;
  const cachedResponse = getFromCache<Record<string, unknown>>(cacheKey);
  if (cachedResponse) {
    return Response.json(cachedResponse, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Cache": "HIT",
      },
    });
  }

  const conditions: Record<string, unknown>[] = [];

  if (uniqueCategories.length > 0) {
    // Categories shown on cards are derived via matchBusinessToCategory(sector,
    // keywords), not the raw `sector` literal. Mirror that derivation here by
    // matching the same keyword lists against sector + keywords.
    const categoryConditions: Record<string, unknown>[] = [];

    for (const cat of uniqueCategories) {
      const keywords = CATEGORY_KEYWORDS[cat as keyof typeof CATEGORY_KEYWORDS] ?? [];
      if (keywords.length === 0) continue;

      const keywordConditions: Record<string, unknown>[] = [];
      for (const keyword of keywords) {
        keywordConditions.push({
          OR: [
            { sector: { contains: keyword, mode: "insensitive" as const } },
            { keywords: { contains: keyword, mode: "insensitive" as const } },
          ],
        });
      }

      categoryConditions.push({ OR: keywordConditions });
    }

    if (categoryConditions.length > 0) {
      conditions.push({ OR: categoryConditions });
    }
  }

  if (minRating !== null || maxRating !== null) {
    const ratingConditions: Record<string, unknown>[] = [];

    // Always include businesses with no rating (null)
    ratingConditions.push({ rating: null });

    // Add range filter for businesses that have a rating
    const ratingFilter: Record<string, number> = {};
    if (minRating !== null && minRating > 0) ratingFilter.gte = minRating;
    if (maxRating !== null) ratingFilter.lte = maxRating;
    if (Object.keys(ratingFilter).length > 0) {
      ratingConditions.push({ rating: ratingFilter });
    }

    conditions.push({ OR: ratingConditions });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
        { keywords: { contains: search, mode: "insensitive" as const } },
        { sector: { contains: search, mode: "insensitive" as const } },
        { address: { contains: search, mode: "insensitive" as const } },
      ],
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const select = {
    id: true,
    name: true,
    description: true,
    sector: true,
    keywords: true,
    rating: true,
    reviewCount: true,
    logo: true,
    username: true,
    address: true,
    phone: true,
    createdAt: true,
  };

  try {
    const [businesses, totalCount] = await prisma.$transaction([
      prisma.business.findMany({
        where,
        select,
        orderBy: sortToOrderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.business.count({ where }),
    ]);

    const newArrivalCutoff = new Date(
      Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const payload = {
      partners: businesses.map((business) =>
        toPartner(business, newArrivalCutoff),
      ),
      totalCount,
      page,
      pageSize,
      categories: [...MARKETPLACE_CATEGORIES],
    };

    setInCache(cacheKey, payload);

    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[marketplace/partners] query failed:", err);
    return Response.json(
      { error: "Failed to load partners" },
      { status: 500 },
    );
  }
}
