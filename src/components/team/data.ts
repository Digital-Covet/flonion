import { api, NETWORK_ERROR } from "~/components/onboarding/ui";
import { ROLE_DEFINITIONS } from "~/lib/roles";

/**
 * Team settings state and fetching (spec §6, `/settings/team`: members,
 * invitations and join-request queues).
 *
 * Types and plain functions only — the page imports this module, so nothing
 * here may reach for Prisma or anything else that belongs on the server.
 */

// ─── Shapes ──────────────────────────────────────────────────────────────

/** One row of `GET /api/team/members`. */
export type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
  /** Owns the business, so the server refuses every change to this row. */
  isOwner: boolean;
};

/** One row of `GET /api/team/invitations`. Cancelled invites aren't listed. */
export type TeamInvitation = {
  id: string;
  email: string;
  role: string;
  status: "pending" | "declined" | string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null; email: string } | null;
};

/** One row of `GET /api/team/join-requests`, pending or recently resolved. */
export type TeamJoinRequest = {
  id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  /** The role granted on approval; null while pending. */
  grantedRole: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; image: string | null };
  reviewedBy: { name: string | null; email: string } | null;
};

/** What the signed-in user may do, from `GET /api/business`. */
export type Viewer = {
  userId: string;
  isOwner: boolean;
  role: string;
};

/**
 * Mirrors `canManageTeam` on the server (src/lib/business-context.ts): owners
 * and admins invite, review requests, change roles and remove members. The
 * server decides; this only keeps the page from offering actions that would
 * come back 403, and hides the two listings that answer 403 outright.
 */
export function canManageTeam(viewer: Viewer | undefined): boolean {
  return Boolean(viewer && (viewer.isOwner || viewer.role === "admin"));
}

export const ROLE_OPTIONS = ROLE_DEFINITIONS.map((r) => ({
  value: r.value,
  label: r.label,
  description: r.description,
}));

/** Same shape the invite endpoint validates with, checked before the trip. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function inviteEmailProblem(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Enter the email address you want to invite.";
  if (!EMAIL_RE.test(email))
    return "Enter an email address like name@business.com.";
  return undefined;
}

// ─── Loading ─────────────────────────────────────────────────────────────

async function load<T>(path: string, what: string): Promise<T[]> {
  const res = await api<T[]>(path);
  if (res.status === 401) {
    signInAgain();
    return [];
  }
  if (!res.ok) throw new Error(res.data.error ?? `Failed to load ${what}`);
  return (res.data as T[]) ?? [];
}

export function loadMembers(): Promise<TeamMemberRow[]> {
  return load<TeamMemberRow>("/api/team/members", "your team");
}

export function loadInvitations(): Promise<TeamInvitation[]> {
  return load<TeamInvitation>("/api/team/invitations", "your invitations");
}

export function loadJoinRequests(): Promise<TeamJoinRequest[]> {
  return load<TeamJoinRequest>("/api/team/join-requests", "join requests");
}

// ─── Actions ─────────────────────────────────────────────────────────────

/** Every team action reports the same way: done, or a sentence to show. */
export type TeamResult = { ok: true } | { ok: false; message: string };

function signInAgain() {
  if (typeof window === "undefined") return;
  window.location.assign("/login?callbackURL=/settings/team");
}

/**
 * The server carries the real rule for each of these, and its `error` is
 * already written for the owner ("The business owner cannot be modified",
 * "That account is already part of another team"), so it is shown as-is and
 * `fallback` only covers a response that arrives without one.
 */
async function act(
  path: string,
  init: { method: string; body?: unknown },
  fallback: string,
): Promise<TeamResult> {
  try {
    const { ok, status, data } = await api(path, init);
    if (ok) return { ok: true };
    if (status === 401) {
      signInAgain();
      return { ok: false, message: "Your session expired. Sign in again." };
    }
    return { ok: false, message: data.error ?? fallback };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

export function changeMemberRole(
  memberId: string,
  role: string,
): Promise<TeamResult> {
  return act(
    `/api/team/members/${memberId}`,
    { method: "PATCH", body: { role } },
    "We couldn't change that role.",
  );
}

export function removeMember(memberId: string): Promise<TeamResult> {
  return act(
    `/api/team/members/${memberId}`,
    { method: "DELETE" },
    "We couldn't remove that member.",
  );
}

export function sendInvitation(
  email: string,
  role: string,
): Promise<TeamResult> {
  return act(
    "/api/team/invite",
    { method: "POST", body: { email: email.trim(), role } },
    "We couldn't send that invitation.",
  );
}

export function cancelInvitation(invitationId: string): Promise<TeamResult> {
  return act(
    `/api/team/invitations/${invitationId}`,
    { method: "DELETE" },
    "We couldn't cancel that invitation.",
  );
}

export function reviewJoinRequest(
  requestId: string,
  action: "approve" | "reject",
  role?: string,
): Promise<TeamResult> {
  return act(
    `/api/team/join-requests/${requestId}`,
    {
      method: "PATCH",
      body: action === "approve" ? { action, role } : { action },
    },
    action === "approve"
      ? "We couldn't approve that request."
      : "We couldn't reject that request.",
  );
}

// ─── Sorting & formatting ────────────────────────────────────────────────

/** Owner first, then the signed-in user, then the order the server sent. */
export function sortMembers(
  members: TeamMemberRow[],
  viewerId: string,
): TeamMemberRow[] {
  const rank = (m: TeamMemberRow) =>
    m.isOwner ? 0 : m.id === viewerId ? 1 : 2;
  return [...members].sort((a, b) => rank(a) - rank(b));
}

export const isPending = (row: { status: string }) => row.status === "pending";

/** Pending work first; within each group the server's order is kept. */
export function pendingFirst<T extends { status: string }>(rows: T[]): T[] {
  return [...rows.filter(isPending), ...rows.filter((r) => !isPending(r))];
}

export function pendingCount(rows: { status: string }[]): number {
  return rows.filter(isPending).length;
}

export function isExpired(
  invitation: TeamInvitation,
  now = new Date(),
): boolean {
  const at = new Date(invitation.expiresAt).getTime();
  return !Number.isNaN(at) && at <= now.getTime();
}

/** "12 Sep 2026" — dates here are never precise enough to need a time. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Expires in 6 days", "Expires tomorrow", or "Expired 12 Sep 2026". */
export function expiryLabel(
  invitation: TeamInvitation,
  now = new Date(),
): string {
  const at = new Date(invitation.expiresAt).getTime();
  if (Number.isNaN(at)) return "";
  if (at <= now.getTime()) return `Expired ${formatDate(invitation.expiresAt)}`;
  const days = Math.ceil((at - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

/** The display name, falling back to the address when a user never set one. */
export function personName(person: { name: string; email: string }): string {
  return person.name?.trim() || person.email;
}
