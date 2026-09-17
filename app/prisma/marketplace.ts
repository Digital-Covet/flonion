import { db } from "./db";
import { parsePageParams, offset, orderBy, likeTerm, pageResult, type PageResult } from "./paging";

// ---------------------------------------------------------------------------
// Category distribution
// ---------------------------------------------------------------------------

/**
 * Guarded copy of the category matcher. Keep in sync with the tenant app's
 * categories. Returns the category name for a business, or "Uncategorised"
 * if no keywords match.
 */
const CATEGORIES: Record<string, string[]> = {
  "Restaurant & Food": ["restaurant", "food", "cafe", "coffee", "pizza", "burger", "sushi", "bakery", "bar", "pub"],
  "Health & Medical": ["health", "medical", "doctor", "clinic", "hospital", "dental", "pharmacy", "gym", "fitness"],
  "Beauty & Spa": ["beauty", "salon", "spa", "hair", "nail", "skincare", "cosmetic"],
  "Home Services": ["plumber", "electrician", "hvac", "cleaning", "landscaping", "roofing", "painting"],
  "Retail & Shopping": ["retail", "shop", "store", "boutique", "fashion", "clothing", "electronics"],
  "Professional Services": ["consulting", "accounting", "legal", "law", "finance", "insurance"],
  "Education & Training": ["education", "school", "training", "tutor", "course", "learning"],
  "Automotive": ["auto", "car", "mechanic", "repair", "tire", "detailing"],
  "Real Estate": ["real estate", "property", "realtor", "mortgage", "housing"],
  "Travel & Hospitality": ["hotel", "travel", "tour", "vacation", "hostel", "booking"],
};

function matchCategory(keywords: string | null): string {
  if (!keywords) return "Uncategorised";
  const lower = keywords.toLowerCase();
  for (const [cat, terms] of Object.entries(CATEGORIES)) {
    if (terms.some((t) => lower.includes(t))) return cat;
  }
  return "Uncategorised";
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export async function getCategoryDistribution(): Promise<CategoryDistribution[]> {
  const businesses = await db.business.findMany({
    select: { keywords: true },
  });

  const counts: Record<string, number> = {};
  for (const biz of businesses) {
    const cat = matchCategory(biz.keywords);
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Partner-readiness
// ---------------------------------------------------------------------------

export interface PartnerRow {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  description: string | null;
  sector: string | null;
  keywords: string | null;
  servicesCount: number;
  projectsCount: number;
  contactsCount: number;
  futureSlots: number;
  completeness: number;
}

const PARTNER_SORT: Record<string, string> = {
  completeness: "createdAt", // approximate — actual score computed in JS
  name: "name",
  createdAt: "createdAt",
};

export async function listPartnerReadiness(
  searchParams: URLSearchParams,
): Promise<PageResult<PartnerRow>> {
  const params = parsePageParams(searchParams, PARTNER_SORT, "createdAt");

  const where: Record<string, unknown> = {};

  const q = searchParams.get("q");
  if (q) {
    const term = likeTerm(q);
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { keywords: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const now = new Date().toISOString();

  const [rows, total] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        id: true,
        name: true,
        username: true,
        logo: true,
        description: true,
        sector: true,
        keywords: true,
        _count: {
          select: {
            services: true,
            projects: true,
            contacts: true,
            availabilitySlots: { where: { date: { gte: now }, isBooked: false } },
          },
        },
      },
    }),
    db.business.count({ where }),
  ]);

  const mapped = rows.map((biz) => {
    let score = 0;
    if (biz.username) score += 25;
    if (biz.logo) score += 15;
    if (biz.description) score += 15;
    if (biz.sector) score += 15;
    if (biz.keywords) score += 10;
    if (biz._count.services > 0) score += 10;
    if (biz._count.projects > 0) score += 5;
    if (biz._count.contacts > 0) score += 5;

    return {
      id: biz.id,
      name: biz.name,
      username: biz.username,
      logo: biz.logo,
      description: biz.description,
      sector: biz.sector,
      keywords: biz.keywords,
      servicesCount: biz._count.services,
      projectsCount: biz._count.projects,
      contactsCount: biz._count.contacts,
      futureSlots: biz._count.availabilitySlots,
      completeness: score,
    };
  });

  return pageResult(mapped, total, params);
}

// ---------------------------------------------------------------------------
// Favourites leaderboard
// ---------------------------------------------------------------------------

export interface FavouriteRow {
  businessId: string;
  businessName: string;
  businessUsername: string | null;
  count: number;
}

export async function getFavouritesLeaderboard(
  limit = 20,
): Promise<{ rows: FavouriteRow[]; orphanedCount: number }> {
  const [grouped, orphaned] = await Promise.all([
    db.favoritePartner.groupBy({
      by: ["businessId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    }),
    // Orphaned favourites: userId references a deleted user
    db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM favorite_partner fp LEFT JOIN "user" u ON u.id = fp.user_id WHERE u.id IS NULL`,
    ),
  ]);

  const bizIds = grouped.map((g) => g.businessId);
  const businesses = await db.business.findMany({
    where: { id: { in: bizIds } },
    select: { id: true, name: true, username: true },
  });
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  return {
    rows: grouped.map((g) => ({
      businessId: g.businessId,
      businessName: bizMap.get(g.businessId)?.name ?? "Deleted",
      businessUsername: bizMap.get(g.businessId)?.username ?? null,
      count: g._count.id,
    })),
    orphanedCount: Number(orphaned[0]?.count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// New arrivals
// ---------------------------------------------------------------------------

export async function getNewArrivals(days = 30): Promise<{ id: string; name: string; username: string | null; createdAt: string }[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return db.business.findMany({
    where: { createdAt: { gte: cutoff.toISOString() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, username: true, createdAt: true },
  });
}
