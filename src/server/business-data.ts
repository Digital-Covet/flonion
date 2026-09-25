import { Effect } from "effect";
import { effectivePlan, isBilling } from "~/lib/plans";
import type { DbError } from "~/server/effect/errors";
import { requireSessionOrLogin } from "~/server/effect/guards";
import { runServerFn } from "~/server/effect/server-fn";
import { Db } from "~/server/effect/services/db";
import type { BusinessInfo } from "~/types/business";

/**
 * The single reader of a user's business. `getBusiness()` and
 * `GET /api/business` both go through this so the two can never drift.
 */
export const loadBusinessInfo = Effect.fn("loadBusinessInfo")(function* (
  userId: string,
): Effect.fn.Return<BusinessInfo, DbError, Db> {
  const db = yield* Db;
  const user = yield* db.use((p) =>
    p.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        role: true,
        businessId: true,
        business: true,
        team: true,
      },
    }),
  );

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

  const businessId = business?.id;
  const [teamMembers, liveSub] = businessId
    ? yield* Effect.all(
        [
          db.use((p) =>
            p.user.findMany({
              where: { businessId },
              select: { id: true, name: true, email: true, image: true },
            }),
          ),
          db.use((p) =>
            p.billingSubscription.findUnique({
              where: { liveBusinessId: businessId },
              select: { status: true, billing: true },
            }),
          ),
        ],
        { concurrency: "unbounded" },
      )
    : [[], null];

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
});

/** Server-only body of `getBusiness`. */
export function loadBusinessInfoForSession(): Promise<BusinessInfo> {
  return runServerFn(
    Effect.gen(function* () {
      const session = yield* requireSessionOrLogin;
      return yield* loadBusinessInfo(session.user.id);
    }),
  );
}
