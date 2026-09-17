import { db } from "./db";
import { recordAudit } from "./audit";
import type { Operator } from "./operator";
import { parsePageParams, offset, orderBy, likeTerm, pageResult, type PageResult } from "./paging";

/**
 * Fields safe to return from the desk. Passwords, tokens, 2FA secrets, and
 * backup codes are never selected — enforced by this tuple, not by
 * component-level filtering.
 */
const SAFE_USER_ACCOUNT_FIELDS = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  twoFactorEnabled: true,
  onboardingCompleted: true,
  banned: true,
  banReason: true,
  banExpires: true,
  businessId: true,
} as const;

export interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: string;
  twoFactorEnabled: boolean | null;
  onboardingCompleted: boolean;
  banned: boolean | null;
  business: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  _count: { sessions: number; sharedReviews: number; feedback: number };
}

const SORT_MAP: Record<string, string> = {
  createdAt: "createdAt",
  name: "name",
  email: "email",
  role: "role",
};

export async function listUsers(
  searchParams: URLSearchParams,
): Promise<PageResult<UserRow>> {
  const params = parsePageParams(searchParams, SORT_MAP, "createdAt");

  const where: Record<string, unknown> = {};

  const q = searchParams.get("q");
  if (q) {
    const term = likeTerm(q);
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const role = searchParams.get("role");
  if (role) where.role = role;

  const emailVerified = searchParams.get("emailVerified");
  if (emailVerified === "true") where.emailVerified = true;
  if (emailVerified === "false") where.emailVerified = false;

  const twoFactor = searchParams.get("twoFactor");
  if (twoFactor === "true") where.twoFactorEnabled = true;
  if (twoFactor === "false") where.twoFactorEnabled = false;

  const onboarded = searchParams.get("onboarded");
  if (onboarded === "true") where.onboardingCompleted = true;
  if (onboarded === "false") where.onboardingCompleted = false;

  const banned = searchParams.get("banned");
  if (banned === "true") where.banned = true;
  if (banned === "false") where.banned = false;

  const hasGoogle = searchParams.get("hasGoogle");
  if (hasGoogle === "true") where.googleToken = { isNot: null };
  if (hasGoogle === "false") where.googleToken = null;

  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  if (createdFrom) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: createdFrom };
  if (createdTo) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: createdTo };

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
      select: {
        ...SAFE_USER_ACCOUNT_FIELDS,
        business: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        _count: {
          select: { sessions: true, sharedReviews: true, feedback: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return pageResult(rows as UserRow[], total, params);
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled: boolean | null;
  onboardingCompleted: boolean;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  business: { id: string; name: string; username: string | null } | null;
  team: { id: string; name: string; username: string | null } | null;
  sessions: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: string;
    createdAt: string;
    impersonatedBy: string | null;
  }>;
  accounts: Array<{
    id: string;
    providerId: string;
    scope: string | null;
    createdAt: string;
  }>;
  twofactors: Array<{
    id: string;
    verified: boolean | null;
    failedVerificationCount: number | null;
    lockedUntil: string | null;
  }>;
  googleToken: { expiresAt: string } | null;
  _count: {
    sessions: number;
    sharedReviews: number;
    feedback: number;
    joinRequests: number;
    assignedTasks: number;
    sentInvitations: number;
  };
}

export async function getUser(id: string): Promise<UserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      ...SAFE_USER_ACCOUNT_FIELDS,
      updatedAt: true,
      banReason: true,
      banExpires: true,
      business: { select: { id: true, name: true, username: true } },
      team: { select: { id: true, name: true, username: true } },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          expiresAt: true,
          createdAt: true,
          impersonatedBy: true,
        },
      },
      accounts: {
        select: {
          id: true,
          providerId: true,
          scope: true,
          createdAt: true,
        },
      },
      twofactors: {
        select: {
          id: true,
          verified: true,
          failedVerificationCount: true,
          lockedUntil: true,
        },
      },
      googleToken: {
        select: { expiresAt: true },
      },
      _count: {
        select: {
          sessions: true,
          sharedReviews: true,
          feedback: true,
          joinRequests: true,
          assignedTasks: true,
          sentInvitations: true,
        },
      },
    },
  });

  return user as UserDetail | null;
}

/** Standing is "Owner of X", "Member of Y", or "Unattached". */
export function computeStanding(
  user: { business: { id: string; name: string } | null; team: { id: string; name: string } | null },
): string {
  if (user.business) return `Owner of ${user.business.name}`;
  if (user.team) return `Member of ${user.team.name}`;
  return "Unattached";
}

// ---------------------------------------------------------------------------
// Write helpers — all mutations run inside a transaction with audit logging.
// Every update writes updatedAt explicitly since the desk's client has no
// @updatedAt directive.
// ---------------------------------------------------------------------------

/**
 * Team roles the desk may assign. Mirrors ROLE_DEFINITIONS in the tenant's
 * src/lib/roles.ts. `platform_admin` is deliberately absent: it grants
 * better-auth admin-plugin permissions across every tenant, so it is granted
 * by hand in the database, never from a form.
 */
const ASSIGNABLE_ROLES = new Set([
  "admin",
  "member",
  "designer",
  "developer",
  "manager",
  "marketing",
]);

export async function setUserRole(
  id: string,
  role: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  if (!ASSIGNABLE_ROLES.has(role)) {
    throw new Error(`Role "${role}" cannot be assigned from the desk`);
  }
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { role: true } });
    await tx.user.update({ where: { id }, data: { role, updatedAt: new Date().toISOString() } });
    await recordAudit(operator, {
      action: "user.role.set",
      entity: "user",
      entityId: id,
      before,
      after: { role },
      ip,
    }, tx);
  });
}

export async function toggleOnboarding(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { onboardingCompleted: true } });
    const next = !before?.onboardingCompleted;
    await tx.user.update({ where: { id }, data: { onboardingCompleted: next, updatedAt: new Date().toISOString() } });
    await recordAudit(operator, {
      action: "user.onboarding.toggle",
      entity: "user",
      entityId: id,
      before,
      after: { onboardingCompleted: next },
      ip,
    }, tx);
  });
}

export async function forceEmailVerified(
  id: string,
  verified: boolean,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { emailVerified: true } });
    await tx.user.update({ where: { id }, data: { emailVerified: verified, updatedAt: new Date().toISOString() } });
    await recordAudit(operator, {
      action: "user.emailVerified.set",
      entity: "user",
      entityId: id,
      before,
      after: { emailVerified: verified },
      ip,
    }, tx);
  });
}

export async function revokeSession(
  sessionId: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId }, select: { id: true, userId: true } });
    if (!session) return;
    await tx.session.delete({ where: { id: sessionId } });
    await recordAudit(operator, {
      action: "user.session.revoke",
      entity: "session",
      entityId: sessionId,
      note: `Revoked session for user ${session.userId}`,
      ip,
    }, tx);
  });
}

export async function revokeAllSessions(
  userId: string,
  operator: Operator,
  ip?: string,
): Promise<number> {
  return db.$transaction(async (tx) => {
    const result = await tx.session.deleteMany({ where: { userId } });
    await recordAudit(operator, {
      action: "user.sessions.revokeAll",
      entity: "user",
      entityId: userId,
      after: { revokedCount: result.count },
      ip,
    }, tx);
    return result.count;
  });
}

export async function clear2FALockout(
  userId: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.twoFactor.findFirst({ where: { userId }, select: { lockedUntil: true, failedVerificationCount: true } });
    await tx.twoFactor.updateMany({ where: { userId }, data: { lockedUntil: null, failedVerificationCount: 0 } });
    await recordAudit(operator, {
      action: "user.2fa.lockout.clear",
      entity: "user",
      entityId: userId,
      before,
      after: { lockedUntil: null, failedVerificationCount: 0 },
      ip,
    }, tx);
  });
}

export async function banUser(
  id: string,
  reason: string | null,
  expiresAt: string | null,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { banned: true, banReason: true, banExpires: true } });
    await tx.user.update({
      where: { id },
      data: { banned: true, banReason: reason ?? null, banExpires: expiresAt ? new Date(expiresAt) : null, updatedAt: new Date().toISOString() },
    });
    await recordAudit(operator, {
      action: "user.ban",
      entity: "user",
      entityId: id,
      before,
      after: { banned: true, banReason: reason, banExpires: expiresAt },
      ip,
    }, tx);
  });
}

export async function unbanUser(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { banned: true } });
    await tx.user.update({
      where: { id },
      data: { banned: false, banReason: null, banExpires: null, updatedAt: new Date().toISOString() },
    });
    await recordAudit(operator, {
      action: "user.unban",
      entity: "user",
      entityId: id,
      before,
      after: { banned: false },
      ip,
    }, tx);
  });
}

export async function deleteUser(
  id: string,
  operator: Operator,
  ip?: string,
): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          sessions: true,
          accounts: true,
          twofactors: true,
          sharedReviews: true,
          feedback: true,
          assignedTasks: true,
          sentInvitations: true,
          joinRequests: true,
          reviewedJoinRequests: true,
        },
      },
      business: { select: { _count: { select: { services: true, projects: true, contacts: true, tasks: true, teamMembers: true, sharedReviews: true, meetingRequests: true, invitations: true, joinRequests: true, favoritePartners: true, availabilitySlots: true, teamMeetings: true } } } },
    },
  });

  if (!user) return { ok: false, counts: {} };

  const userCounts = user._count;
  const bizCounts = user.business?._count ?? {};
  const totalBizChildren = Object.values(bizCounts).reduce((a, b) => a + b, 0);

  await db.$transaction(async (tx) => {
    await tx.user.delete({ where: { id } });
    await recordAudit(operator, {
      action: "user.delete",
      entity: "user",
      entityId: id,
      before: { ...userCounts, businessChildren: totalBizChildren } as unknown as Record<string, unknown>,
      note: `Deleted user with ${userCounts.sharedReviews} reviews, business with ${totalBizChildren} children`,
      ip,
    }, tx);
  });

  return { ok: true, counts: { ...userCounts, ...bizCounts } as unknown as Record<string, number> };
}
