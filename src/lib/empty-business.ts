import type { Prisma } from "@generated/prisma/client";
import type { prisma } from "~/db/prisma";

/**
 * Deciding whether an owned business can be discarded so its owner can join
 * someone else's team.
 *
 * The single-business model (see `business-context.ts`) means owning a business
 * and belonging to a team are mutually exclusive, so a user who ran the
 * onboarding wizard by mistake used to be locked out of every invitation
 * forever. The escape hatch is narrow on purpose: the business is deleted only
 * when nothing has ever been hung off it, and only with the owner's explicit
 * consent.
 */

/** Accepts the singleton or a transaction client, so the claim paths can
 * re-check emptiness *inside* their transaction rather than trusting a
 * pre-flight that ran on another connection. */
type Db = typeof prisma | Prisma.TransactionClient;

export interface OwnedBusinessInspection {
  id: string;
  name: string;
  empty: boolean;
  /** Human-readable reasons, safe to render back to the owner. */
  blockers: string[];
}

/**
 * Aborts a claim transaction.
 *
 * Prisma's interactive `$transaction` commits everything already written unless
 * the callback *throws* — returning a value commits. Both claim paths write
 * before they can discover a conflict, so every abort has to throw and be
 * mapped to a status code outside the transaction.
 */
export class ClaimConflictError extends Error {
  constructor(
    readonly code:
      | "not_pending"
      | "user_gone"
      | "joined_elsewhere"
      | "needs_consent"
      | "owns_business",
    readonly blockers: string[] = [],
  ) {
    super(code);
    this.name = "ClaimConflictError";
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Returns null when the business does not exist or is not owned by `ownerId`.
 *
 * `empty` is false as soon as anything hangs off the business. Profile fields
 * typed during onboarding (name, username, logo, sector, address, keywords,
 * description) are deliberately *not* blockers — step 1 of the wizard prompts
 * for most of them, so counting them as "touched" would mean the hatch never
 * opens. Records that hang off `User` rather than `Business` — SharedReview,
 * GoogleToken, the user's own FavoritePartner rows — survive the deletion and
 * so are not blockers either.
 */
export async function inspectOwnedBusiness(
  db: Db,
  businessId: string,
  ownerId: string,
): Promise<OwnedBusinessInspection | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      userId: true,
      placeId: true,
      reviewLink: true,
      reviewLinks: true,
      qrScanCount: true,
      _count: {
        select: {
          // The owner's own `User.businessId` normally points here, and is NULL
          // for anyone who onboarded before that column existed, so neither 0
          // nor 1 is a safe bare expectation — exclude them explicitly.
          teamMembers: { where: { id: { not: ownerId } } },
          joinRequests: { where: { status: "pending" } },
          invitations: true,
          tasks: true,
          projects: true,
          services: true,
          contacts: true,
          teamMeetings: true,
          meetingRequests: true,
          availabilitySlots: true,
          favoritePartners: true,
        },
      },
    },
  });

  if (!business || business.userId !== ownerId) return null;

  const c = business._count;
  const blockers: string[] = [];

  if (c.teamMembers > 0) blockers.push(plural(c.teamMembers, "team member"));
  if (c.invitations > 0)
    blockers.push(plural(c.invitations, "sent invitation"));
  if (c.joinRequests > 0) {
    blockers.push(plural(c.joinRequests, "pending join request"));
  }
  if (c.tasks > 0) blockers.push(plural(c.tasks, "task"));
  if (c.projects > 0) blockers.push(plural(c.projects, "project"));
  if (c.services > 0) blockers.push(plural(c.services, "service"));
  if (c.contacts > 0) blockers.push(plural(c.contacts, "contact"));
  if (c.teamMeetings > 0) blockers.push(plural(c.teamMeetings, "team meeting"));
  if (c.meetingRequests > 0) {
    blockers.push(plural(c.meetingRequests, "meeting request"));
  }
  if (c.availabilitySlots > 0) {
    blockers.push(plural(c.availabilitySlots, "availability slot"));
  }
  if (c.favoritePartners > 0) {
    blockers.push(plural(c.favoritePartners, "partner bookmark"));
  }
  if (business.qrScanCount > 0) {
    blockers.push(plural(business.qrScanCount, "QR scan"));
  }
  if (business.placeId || business.reviewLink) {
    blockers.push("a connected review profile");
  }
  if (
    typeof business.reviewLinks === "object" &&
    business.reviewLinks !== null &&
    !Array.isArray(business.reviewLinks) &&
    Object.keys(business.reviewLinks).length > 0
  ) {
    blockers.push("saved review links");
  }

  return {
    id: business.id,
    name: business.name,
    empty: blockers.length === 0,
    blockers,
  };
}
