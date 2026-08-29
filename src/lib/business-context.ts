import { prisma } from "~/db/prisma";

/**
 * The business a user is currently acting in, plus their standing within it.
 *
 * Two links exist between users and businesses and they mean different things:
 * `Business.userId` is ownership (one business per owner) and `User.businessId`
 * is membership (the team the user currently belongs to). Under the single
 * business model a user has one or the other, never both, so `isOwner` compares
 * the two by business id — owning *some* business elsewhere must never confer
 * rights inside the team the user is acting in.
 */
export interface BusinessContext {
  userId: string;
  businessId: string;
  role: string;
  isOwner: boolean;
}

export async function getBusinessContext(
  userId: string,
): Promise<BusinessContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      businessId: true,
      role: true,
      business: { select: { id: true } },
    },
  });

  if (!user) return null;

  // Owners are resolved from the business they own even when `businessId` is
  // stale. That column is only ever written by POST /api/business, so anyone who
  // onboarded before it existed has it NULL — and without this fallback every
  // team route answers "No business found" to the business's own owner.
  const businessId = user.businessId ?? user.business?.id ?? null;

  if (!businessId) return null;

  return {
    userId,
    businessId,
    role: user.role,
    isOwner: user.business?.id === businessId,
  };
}

/** Owners and admins may invite, remove members, and change roles. */
export function canManageTeam(ctx: BusinessContext): boolean {
  return ctx.isOwner || ctx.role === "admin";
}
