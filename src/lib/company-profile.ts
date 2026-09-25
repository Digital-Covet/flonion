import { Effect } from "effect";
import type { DbError } from "~/server/effect/errors";
import { Db } from "~/server/effect/services/db";

/**
 * Public company-profile reads.
 *
 * Lives here rather than inside the route handlers because the SSR pass of
 * `/company/[companyname]` needs them too: `getCompanyPage` runs them through
 * `runServerFn`, the `/api/marketplace/*` routes through `handler`. Server
 * only: reach it through `await import(...)` from a `"use server"` body.
 */

export interface CompanyProfile {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  description: string | null;
  sector: string | null;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  phone: string | null;
}

export interface CompanyService {
  id: string;
  icon: string;
  title: string;
  description: string;
  position: number;
}

export interface CompanyProject {
  id: string;
  imageUrl: string;
  altText: string;
  position: number;
}

export interface CompanyContact {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  email: string | null;
  position: number;
}

/** Looks a business up by its vanity username, falling back to its id. */
export const getCompanyProfile = Effect.fn("getCompanyProfile")(function* (
  identifier: string,
) {
  const key = identifier.trim();
  if (!key) return null;

  // A suspended business has no public profile: it reads as not found.
  const db = yield* Db;
  const business =
    (yield* db.use((p) =>
      p.business.findUnique({ where: { username: key, status: "active" } }),
    )) ||
    (yield* db.use((p) =>
      p.business.findUnique({ where: { id: key, status: "active" } }),
    ));

  if (!business) return null;

  const profile: CompanyProfile = {
    id: business.id,
    name: business.name,
    username: business.username,
    logo: business.logo,
    description: business.description,
    sector: business.sector,
    rating: business.rating,
    reviewCount: business.reviewCount,
    address: business.address,
    phone: business.phone,
  };
  return profile;
});

export const getCompanyServices = (
  businessId: string,
): Effect.Effect<CompanyService[], DbError, Db> =>
  Db.use((db) =>
    db.use((p) =>
      p.service.findMany({
        where: { businessId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          icon: true,
          title: true,
          description: true,
          position: true,
        },
      }),
    ),
  );

export const getCompanyProjects = (
  businessId: string,
): Effect.Effect<CompanyProject[], DbError, Db> =>
  Db.use((db) =>
    db.use((p) =>
      p.project.findMany({
        where: { businessId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          imageUrl: true,
          altText: true,
          position: true,
        },
      }),
    ),
  );

export const getCompanyContacts = (
  businessId: string,
): Effect.Effect<CompanyContact[], DbError, Db> =>
  Db.use((db) =>
    db.use((p) =>
      p.businessContact.findMany({
        where: { businessId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
          email: true,
          position: true,
        },
      }),
    ),
  );
