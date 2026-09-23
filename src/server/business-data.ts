import { effectivePlan, isBilling } from "~/lib/plans";
import type { BusinessInfo } from "~/types/business";

/**
 * The single reader of a user's business. `getBusiness()` and
 * `GET /api/business` both go through this so the two can never drift.
 */
export async function loadBusinessInfo(userId: string): Promise<BusinessInfo> {
  const { prisma } = await import("~/db/prisma");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleted: true,
      role: true,
      businessId: true,
      business: true,
      team: true,
    },
  });

  // Members have no `business` of their own — the business they work in is the
  // one `businessId` points at. Reading only the owner relation is what left
  // Settings, the sidebar and task assignees blank for invited users.
  const business = user?.team ?? user?.business ?? null;
  const isOwner = !!business && business.userId === userId;

  const reviewLinks =
    business?.reviewLinks &&
    typeof business.reviewLinks === "object" &&
    !Array.isArray(business.reviewLinks)
      ? (business.reviewLinks as Record<string, string>)
      : {};

  const teamMembers = business?.id
    ? await prisma.user.findMany({
        where: { businessId: business.id },
        select: { id: true, name: true, email: true, image: true },
      })
    : [];

  const liveSub = business?.id
    ? await prisma.billingSubscription.findUnique({
        where: { liveBusinessId: business.id },
        select: { status: true, billing: true },
      })
    : null;

  return {
    currentUserId: userId,
    ownerId: business?.userId ?? null,
    businessId: business?.id ?? "",
    isOwner,
    role: user?.role ?? "member",
    placeId: business?.placeId ?? "",
    reviewLink: business?.reviewLink ?? "",
    reviewLinks,
    logo: business?.logo ?? null,
    businessName: business?.name ?? "",
    username: business?.username ?? "",
    phone: business?.phone ?? "",
    address: business?.address ?? "",
    sector: business?.sector ?? "",
    keywords: business?.keywords ?? "",
    description: business?.description ?? "",
    rating: business?.rating ?? 0,
    reviewCount: business?.reviewCount ?? 0,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    teamMembers,
    plan: business ? effectivePlan(business) : "starter",
    planExpiresAt: business?.planExpiresAt?.toISOString() ?? null,
    subscription:
      liveSub && isBilling(liveSub.billing)
        ? {
            status: liveSub.status,
            billing: liveSub.billing,
            renews: liveSub.status === "ACTIVE",
          }
        : null,
  };
}
