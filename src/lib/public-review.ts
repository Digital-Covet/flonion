import { query } from "@solidjs/router";
import type { ReviewPlatformSlug } from "~/features/settings/review-platforms";

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

/**
 * The business behind `/company/:username/review`. Server-loaded so the
 * business name (the page's LCP) is in the first HTML.
 */
export const getCompanyReview = query(
  async (param: string): Promise<PublicReview> => {
    "use server";
    const { loadCompanyReview } = await import("~/server/public-review-data");
    return loadCompanyReview(param);
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
  const { loadLegacyReviewTarget } = await import(
    "~/server/public-review-data"
  );
  return loadLegacyReviewTarget(id);
}, "legacy-review-target");
