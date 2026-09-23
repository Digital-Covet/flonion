import type { Billing, PlanId } from "~/lib/plans";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The business the signed-in user works in, as every page in the signed-in app
 * reads it. Served by `getBusiness()` (and, for any remaining client caller,
 * by `GET /api/business`) — both go through `loadBusinessInfo`.
 */
export type BusinessInfo = {
  currentUserId: string;
  /** The owner of the business, which is not necessarily the current user. */
  ownerId: string | null;
  businessId: string;
  isOwner: boolean;
  role: string;
  placeId: string;
  reviewLink: string;
  reviewLinks: Record<string, string>;
  logo: string | null;
  businessName: string;
  username: string;
  phone: string;
  address: string;
  sector: string;
  keywords: string;
  description: string;
  rating: number;
  reviewCount: number;
  onboardingCompleted: boolean;
  teamMembers: TeamMember[];
  /** The plan in force now, already past `effectivePlan()`'s expiry check. */
  plan: PlanId;
  /** End of the paid period (ISO), or null on Starter. */
  planExpiresAt: string | null;
  /**
   * The live Cashfree subscription, if any. `renews` is false once the
   * owner cancelled auto-renew or a pending checkout hasn't been authorised.
   */
  subscription: {
    status: string;
    billing: Billing;
    renews: boolean;
  } | null;
};
