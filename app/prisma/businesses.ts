import { db } from "./db";
import { recordAudit, type AuditEntry } from "./audit";
import type { Operator } from "./operator";
import { parsePageParams, offset, orderBy, likeTerm, pageResult, type PageResult } from "./paging";

export interface BusinessRow {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  sector: string | null;
  keywords: string | null;
  rating: number | null;
  reviewCount: number | null;
  qrScanCount: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    onboardingCompleted: boolean;
  };
  _count: {
    teamMembers: number;
    sharedReviews: number;
    services: number;
    projects: number;
  };
}

const SORT_MAP: Record<string, string> = {
  createdAt: "createdAt",
  name: "name",
  rating: "rating",
  reviewCount: "reviewCount",
  qrScanCount: "qrScanCount",
};

export async function listBusinesses(
  searchParams: URLSearchParams,
): Promise<PageResult<BusinessRow>> {
  const params = parsePageParams(searchParams, SORT_MAP, "createdAt");

  const where: Record<string, unknown> = {};

  // Free text search across name, description, keywords, address
  const q = searchParams.get("q");
  if (q) {
    const term = likeTerm(q);
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { keywords: { contains: term, mode: "insensitive" } },
      { address: { contains: term, mode: "insensitive" } },
    ];
  }

  // Sector filter
  const sector = searchParams.get("sector");
  if (sector) where.sector = sector;

  // Rating range
  const minRating = searchParams.get("minRating");
  const maxRating = searchParams.get("maxRating");
  if (minRating) where.rating = { ...((where.rating as object) ?? {}), gte: Number.parseFloat(minRating) };
  if (maxRating) where.rating = { ...((where.rating as object) ?? {}), lte: Number.parseFloat(maxRating) };

  // Has Google rating
  const hasRating = searchParams.get("hasRating");
  if (hasRating === "true") where.rating = { not: null };
  if (hasRating === "false") where.rating = null;

  // Has Google place
  const hasPlace = searchParams.get("hasPlace");
  if (hasPlace === "true") where.placeId = { not: null };
  if (hasPlace === "false") where.placeId = null;

  // Has review link
  const hasReviewLink = searchParams.get("hasReviewLink");
  if (hasReviewLink === "true") where.reviewLink = { not: null };
  if (hasReviewLink === "false") where.reviewLink = null;

  // Owner onboarded
  const onboarded = searchParams.get("onboarded");
  if (onboarded === "true") where.user = { onboardingCompleted: true };
  if (onboarded === "false") where.user = { onboardingCompleted: false };

  // Created window
  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

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
        sector: true,
        keywords: true,
        rating: true,
        reviewCount: true,
        qrScanCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            onboardingCompleted: true,
          },
        },
        _count: {
          select: {
            teamMembers: true,
            sharedReviews: true,
            services: true,
            projects: true,
          },
        },
      },
    }),
    db.business.count({ where }),
  ]);

  return pageResult(rows as BusinessRow[], total, params);
}

export interface BusinessDetail {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  description: string | null;
  sector: string | null;
  keywords: string | null;
  phone: string | null;
  address: string | null;
  placeId: string | null;
  reviewLink: string | null;
  rating: number | null;
  reviewCount: number | null;
  ratingUpdatedAt: string | null;
  qrScanCount: number;
  workingDays: string;
  workingStartTime: string;
  workingEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    onboardingCompleted: boolean;
    banned: boolean | null;
  };
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean | null;
  }>;
  _count: {
    teamMembers: number;
    sharedReviews: number;
    services: number;
    projects: number;
    contacts: number;
    favoritePartners: number;
    meetingRequests: number;
    tasks: number;
    invitations: number;
    joinRequests: number;
  };
}

export async function getBusiness(id: string): Promise<BusinessDetail | null> {
  const business = await db.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      logo: true,
      description: true,
      sector: true,
      keywords: true,
      phone: true,
      address: true,
      placeId: true,
      reviewLink: true,
      rating: true,
      reviewCount: true,
      ratingUpdatedAt: true,
      qrScanCount: true,
      workingDays: true,
      workingStartTime: true,
      workingEndTime: true,
      bookingStartTime: true,
      bookingEndTime: true,
      slotDuration: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          onboardingCompleted: true,
          banned: true,
        },
      },
      teamMembers: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          twoFactorEnabled: true,
        },
      },
      _count: {
        select: {
          teamMembers: true,
          sharedReviews: true,
          services: true,
          projects: true,
          contacts: true,
          favoritePartners: true,
          meetingRequests: true,
          tasks: true,
          invitations: true,
          joinRequests: true,
        },
      },
    },
  });

  return business as BusinessDetail | null;
}

// ---------------------------------------------------------------------------
// Write helpers — all mutations run inside a transaction with audit logging.
// The desk's Prisma client has no @updatedAt; every update writes it explicitly.
// ---------------------------------------------------------------------------

/** Fields an operator may edit on a business profile. */
const EDITABLE_FIELDS = [
  "name",
  "username",
  "description",
  "phone",
  "address",
  "sector",
  "keywords",
  "logo",
  "reviewLink",
] as const;

export async function updateBusiness(
  id: string,
  data: Record<string, string | null>,
  operator: Operator,
  ip?: string,
): Promise<{ ok: boolean; error?: string }> {
  const allowed: Record<string, string | null> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in data) allowed[key] = data[key];
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, error: "No editable fields provided" };
  }

  allowed.updatedAt = new Date().toISOString();

  try {
    await db.$transaction(async (tx) => {
      const before = await tx.business.findUnique({
        where: { id },
        select: Object.fromEntries(
          Object.keys(allowed).map((k) => [k, true]),
        ) as Record<string, true>,
      });

      await tx.business.update({ where: { id }, data: allowed });

      await recordAudit(
        operator,
        {
          action: "business.update",
          entity: "business",
          entityId: id,
          before,
          after: allowed,
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { ok: false, error: "Username already taken" };
    }
    throw err;
  }
}

export async function clearRatingCache(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.business.findUnique({
      where: { id },
      select: { rating: true, reviewCount: true, ratingUpdatedAt: true },
    });

    await tx.business.update({
      where: { id },
      data: { rating: null, reviewCount: null, ratingUpdatedAt: null, updatedAt: new Date().toISOString() },
    });

    await recordAudit(
      operator,
      {
        action: "business.rating.clear",
        entity: "business",
        entityId: id,
        before,
        after: { rating: null, reviewCount: null, ratingUpdatedAt: null },
        ip,
      },
      tx,
    );
  });
}

export async function resetQrCounter(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.business.findUnique({
      where: { id },
      select: { qrScanCount: true },
    });

    await tx.business.update({
      where: { id },
      data: { qrScanCount: 0, updatedAt: new Date().toISOString() },
    });

    await recordAudit(
      operator,
      {
        action: "business.qr.reset",
        entity: "business",
        entityId: id,
        before,
        after: { qrScanCount: 0 },
        ip,
      },
      tx,
    );
  });
}

export async function bulkSetSector(
  ids: string[],
  sector: string,
  operator: Operator,
  ip?: string,
): Promise<number> {
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.business.updateMany({
      where: { id: { in: ids } },
      data: { sector, updatedAt: new Date().toISOString() },
    });

    await recordAudit(
      operator,
      {
        action: "business.sector.bulk",
        entity: "business",
        entityId: ids.join(","),
        after: { sector, count: updated.count },
        note: `Set sector to "${sector}" on ${updated.count} businesses`,
        ip,
      },
      tx,
    );

    return updated.count;
  });

  return result;
}

export async function deleteBusiness(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<{ ok: boolean; counts: Record<string, number> }> {
  // Load child counts before deletion
  const biz = await db.business.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          teamMembers: true,
          sharedReviews: true,
          services: true,
          projects: true,
          contacts: true,
          favoritePartners: true,
          meetingRequests: true,
          tasks: true,
          invitations: true,
          joinRequests: true,
        },
      },
    },
  });

  if (!biz) return { ok: false, counts: {} };

  const counts = biz._count;

  await db.$transaction(async (tx) => {
    await tx.business.delete({ where: { id } });

    await recordAudit(
      operator,
      {
        action: "business.delete",
        entity: "business",
        entityId: id,
        before: counts as unknown as Record<string, unknown>,
        note: `Deleted business with ${counts.teamMembers} team members, ${counts.sharedReviews} reviews`,
        ip,
      },
      tx,
    );
  });

  return { ok: true, counts: counts as unknown as Record<string, number> };
}
