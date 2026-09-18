import { query } from "@solidjs/router";
import {
  REVIEW_PLATFORMS,
  type ReviewPlatformSlug,
} from "~/features/settings/review-platforms";
import { httpUrl } from "~/lib/safe-url";

export type PublicPlatform = {
  slug: ReviewPlatformSlug;
  label: string;
  url: string;
};

export type PublicBusiness = {
  id: string;
  name: string;
  logo: string | null;
  rating: number | null;
  reviewCount: number | null;
  keywords: string | null;
  platforms: PublicPlatform[];
};

export type PublicReview =
  | { kind: "active"; business: PublicBusiness }
  | { kind: "inactive" };

/** `username` is stored lowercase; the composer falls back to the business id. */
const PARAM_PATTERN = /^[\w.-]{1,64}$/;

const businessSelect = {
  id: true,
  name: true,
  logo: true,
  rating: true,
  reviewCount: true,
  reviewLinks: true,
  reviewLink: true,
  placeId: true,
  keywords: true,
} as const;

/**
 * Platforms in the settings order, with only http(s) links. Businesses set up
 * before `reviewLinks` existed have a single `reviewLink`, treated as Google.
 */
function platformsFrom(business: {
  reviewLinks: unknown;
  reviewLink: string | null;
  placeId: string | null;
}): PublicPlatform[] {
  const map =
    business.reviewLinks &&
    typeof business.reviewLinks === "object" &&
    !Array.isArray(business.reviewLinks)
      ? (business.reviewLinks as Record<string, unknown>)
      : {};

  const platforms: PublicPlatform[] = [];
  for (const p of REVIEW_PLATFORMS) {
    const url = httpUrl(map[p.slug]);
    if (url) platforms.push({ slug: p.slug, label: p.label, url });
  }

  if (platforms.length === 0) {
    const fallback =
      httpUrl(business.reviewLink) ??
      (business.placeId
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(business.placeId)}`
        : null);
    if (fallback) {
      platforms.push({ slug: "google", label: "Google", url: fallback });
    }
  }

  return platforms;
}

/**
 * The business behind `/company/:username/review`. Server-loaded so the
 * business name (the page's LCP) is in the first HTML.
 */
export const getCompanyReview = query(
  async (param: string): Promise<PublicReview> => {
    "use server";
    if (!PARAM_PATTERN.test(param)) return { kind: "inactive" };

    const { prisma } = await import("~/db/prisma");

    // The composer links by username when there is one and by id otherwise.
    const business =
      (await prisma.business.findUnique({
        where: { username: param.toLowerCase() },
        select: businessSelect,
      })) ??
      (await prisma.business.findUnique({
        where: { id: param },
        select: businessSelect,
      }));

    if (!business) return { kind: "inactive" };

    return {
      kind: "active",
      business: {
        id: business.id,
        name: business.name,
        logo: business.logo || null,
        rating: business.rating,
        reviewCount: business.reviewCount,
        keywords: business.keywords || null,
        platforms: platformsFrom(business),
      },
    };
  },
  "company-review",
);

/**
 * Sends a shared-review id to its company page, so links and printed QR codes
 * that point at the old `/review/:id` still reach the review form. Returns
 * null only when the id resolves to no business, which the route renders as an
 * inactive link.
 */
export const legacyReviewTarget = query(async (id: string): Promise<null> => {
  "use server";
  if (!PARAM_PATTERN.test(id)) return null;

  const { prisma } = await import("~/db/prisma");

  const row = await prisma.sharedReview.findUnique({
    where: { id },
    select: {
      business: { select: { id: true, username: true } },
      user: {
        select: { business: { select: { id: true, username: true } } },
      },
    },
  });

  const business = row?.business ?? row?.user.business ?? null;
  if (!business) return null;

  const { redirect } = await import("@solidjs/router");
  throw redirect(`/company/${business.username ?? business.id}/review`, 301);
}, "legacy-review-target");
