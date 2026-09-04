import { prisma } from "~/db/prisma";

/**
 * Public company-profile reads.
 *
 * Lives here rather than inside the route handlers because the SSR pass of
 * `/company/[companyname]` needs them too. On the server the page calls these
 * directly; in the browser it goes through `/api/marketplace/*`. Same reasoning
 * as `~/lib/partners-query` -- the caller guards the import with
 * `import.meta.env.SSR` so Vite folds the branch and Prisma never reaches the
 * client bundle.
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
export async function getCompanyProfile(
  identifier: string,
): Promise<CompanyProfile | null> {
  const key = identifier.trim();
  if (!key) return null;

  const business =
    (await prisma.business.findUnique({ where: { username: key } })) ||
    (await prisma.business.findUnique({ where: { id: key } }));

  if (!business) return null;

  return {
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
}

export function getCompanyServices(businessId: string): Promise<CompanyService[]> {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      icon: true,
      title: true,
      description: true,
      position: true,
    },
  });
}

export function getCompanyProjects(businessId: string): Promise<CompanyProject[]> {
  return prisma.project.findMany({
    where: { businessId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      imageUrl: true,
      altText: true,
      position: true,
    },
  });
}

export function getCompanyContacts(businessId: string): Promise<CompanyContact[]> {
  return prisma.businessContact.findMany({
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
  });
}
