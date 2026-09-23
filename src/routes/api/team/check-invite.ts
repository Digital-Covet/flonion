import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { inspectOwnedBusiness } from "~/lib/empty-business";
import { isInviteToken } from "~/lib/invite-redirect";
import { getSessionFromHeaders } from "~/lib/server-auth";

const INVITATION_SELECT = {
  id: true,
  token: true,
  role: true,
  expiresAt: true,
  business: {
    select: { name: true },
  },
  invitedBy: {
    select: { name: true, email: true },
  },
} as const;

/**
 * Where a specific invitation stands for the signed-in account. The
 * /accept-invite page renders one screen per value.
 */
type InviteState =
  | "pending"
  | "invalid"
  | "wrong_account"
  | "already_member"
  | "in_other_team"
  | "expired"
  | "used"
  | "declined"
  | "cancelled";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      onboardingCompleted: true,
      businessId: true,
      business: { select: { id: true } },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const token = new URL(event.request.url).searchParams.get("token");
  if (token !== null) {
    return checkToken(token, session.user.id, user);
  }

  // Members of someone else's team can't accept anything. Owners still can --
  // accept-invite offers to discard an untouched business for them -- so this
  // no longer short-circuits on `businessId` alone, which for an owner points at
  // the business they own.
  if (user.businessId && user.businessId !== user.business?.id) {
    return Response.json({ invitation: null, ownedBusiness: null });
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      email: user.email.toLowerCase(),
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    select: INVITATION_SELECT,
    orderBy: { createdAt: "desc" },
  });

  // Surfaced alongside the invitation so the UI can warn about the trade before
  // the user clicks accept, rather than after a 409 round-trip.
  const ownedBusiness =
    invitation && user.business
      ? await inspectOwnedBusiness(prisma, user.business.id, session.user.id)
      : null;

  return Response.json({ invitation, ownedBusiness });
}

/**
 * Resolves the invitation behind an emailed link, including the ones that can
 * no longer be accepted, so the page can say *why* rather than showing a
 * generic "not found".
 */
async function checkToken(
  token: string,
  userId: string,
  user: {
    email: string;
    onboardingCompleted: boolean;
    businessId: string | null;
    business: { id: string } | null;
  },
) {
  const account = {
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
  };
  const respond = (
    state: InviteState,
    invitation: unknown = null,
    ownedBusiness: unknown = null,
  ) => Response.json({ state, invitation, ownedBusiness, account });

  if (!isInviteToken(token)) return respond("invalid");

  const found = await prisma.invitation.findUnique({
    where: { token },
    select: {
      ...INVITATION_SELECT,
      email: true,
      businessId: true,
      status: true,
    },
  });

  if (!found) return respond("invalid");

  // Nothing about the business is returned to another account: the token was
  // emailed to one address, and whoever holds it signed in as someone else.
  if (found.email.toLowerCase() !== user.email.toLowerCase()) {
    return respond("wrong_account");
  }

  const { email: _email, businessId, status, ...invitation } = found;

  // Checked before status, matching accept-invite: re-opening the link after
  // joining is a success, not a "this link was already used" dead end.
  if (user.businessId === businessId) {
    return respond("already_member", invitation);
  }

  if (status === "accepted") return respond("used", invitation);
  if (status === "declined") return respond("declined", invitation);
  if (status === "cancelled") return respond("cancelled", invitation);
  if (status === "expired" || found.expiresAt <= new Date()) {
    return respond("expired", invitation);
  }

  if (user.businessId && user.businessId !== user.business?.id) {
    return respond("in_other_team", invitation);
  }

  const ownedBusiness = user.business
    ? await inspectOwnedBusiness(prisma, user.business.id, userId)
    : null;

  return respond("pending", invitation, ownedBusiness);
}
