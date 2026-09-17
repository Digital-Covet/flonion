import { Dialog } from "@ark-ui/solid/dialog";
import { Field } from "@ark-ui/solid/field";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Clock from "lucide-solid/icons/clock";
import ShieldAlert from "lucide-solid/icons/shield-alert";
import Trash2 from "lucide-solid/icons/trash-2";
import UserPlus from "lucide-solid/icons/user-plus";
import Users from "lucide-solid/icons/users";
import { createSignal, For, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SkeletonRows, WidgetError } from "~/components/ui/skeleton";
import { DataTable } from "~/components/ui/table";
import { notify } from "~/components/ui/toast";
import { SectionCard } from "~/features/settings/components/SectionCard";
import { authClient } from "~/lib/auth-client";
import { getRoleLabel, ROLE_DEFINITIONS, type UserRole } from "~/lib/roles";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  /** "pending" | "declined" */
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    name: string;
    email: string;
  };
}

interface JoinRequest {
  id: string;
  message: string | null;
  /** "pending" | "approved" | "rejected" | "cancelled" */
  status: string;
  grantedRole: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  reviewedBy: {
    name: string;
    email: string;
  } | null;
}

const fieldInputClass =
  "w-full rounded-control border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

const selectClass =
  "w-full rounded-control border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10";

export default function TeamPage() {
  const session = authClient.useSession();
  const currentUserId = () => session()?.data?.user?.id;

  const [members, setMembers] = createSignal<TeamMember[]>([]);
  const [invitations, setInvitations] = createSignal<PendingInvitation[]>([]);
  const [ownerId, setOwnerId] = createSignal<string | null>(null);

  const [inviteEmail, setInviteEmail] = createSignal("");
  const [inviteRole, setInviteRole] = createSignal<UserRole>("member");
  const [inviteError, setInviteError] = createSignal("");
  const [sending, setSending] = createSignal(false);

  const [joinRequests, setJoinRequests] = createSignal<JoinRequest[]>([]);
  const [joinRequestError, setJoinRequestError] = createSignal("");
  const [joinForbidden, setJoinForbidden] = createSignal(false);
  const [reviewingId, setReviewingId] = createSignal<string | null>(null);
  const [reviewRoles, setReviewRoles] = createSignal<Record<string, UserRole>>(
    {},
  );
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal("");
  // Accessible confirm dialog replacing native confirm()/unconfirmed deletes.
  const [confirming, setConfirming] = createSignal<{
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmingBusy, setConfirmingBusy] = createSignal(false);

  const runConfirmed = async () => {
    const c = confirming();
    if (!c) return;
    setConfirmingBusy(true);
    try {
      await c.action();
    } finally {
      setConfirmingBusy(false);
      setConfirming(null);
    }
  };

  const roleFor = (requestId: string): UserRole =>
    reviewRoles()[requestId] ?? "member";

  const isAdmin = () => {
    const member = members().find((m) => m.id === currentUserId());
    return member?.role === "admin";
  };

  const isOwner = () => currentUserId() === ownerId();

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/team/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      } else {
        throw new Error("members failed");
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
      setLoadError("Couldn't load the team. Check your connection.");
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await fetch("/api/team/invitations");
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (err) {
      console.error("Failed to fetch invitations:", err);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      const res = await fetch("/api/team/join-requests");
      if (res.ok) {
        const data = await res.json();
        setJoinRequests(data);
        setJoinForbidden(false);
      } else if (res.status === 403) {
        // Plain members can't review the queue — explain instead of showing
        // an empty section that looks broken.
        setJoinForbidden(true);
      }
    } catch (err) {
      console.error("Failed to fetch join requests:", err);
    }
  };

  const handleReviewJoinRequest = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    setReviewingId(requestId);
    setJoinRequestError("");

    try {
      const res = await fetch(`/api/team/join-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role: roleFor(requestId) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const blockers =
          Array.isArray(data?.blockers) && data.blockers.length > 0
            ? ` (${data.blockers.join(", ")})`
            : "";
        setJoinRequestError(
          `${data?.error ?? "Couldn't review the request."}${blockers}`,
        );
      }

      // Refetched either way: a co-admin may have resolved it already, and an
      // approval changes the member list too.
      await Promise.all([fetchJoinRequests(), fetchMembers()]);
      notify(
        "success",
        action === "approve" ? "Request approved" : "Request rejected",
      );
    } catch {
      setJoinRequestError("Couldn't review the request. Please try again.");
    } finally {
      setReviewingId(null);
    }
  };

  const fetchBusiness = async () => {
    try {
      const res = await fetch("/api/business");
      if (res.ok) {
        const data = await res.json();
        setOwnerId(data.ownerId);
      }
    } catch (err) {
      console.error("Failed to fetch business:", err);
    }
  };

  onMount(async () => {
    setLoading(true);
    setLoadError("");
    await Promise.all([
      fetchMembers(),
      fetchInvitations(),
      fetchBusiness(),
      fetchJoinRequests(),
    ]);
    setLoading(false);
  });

  const handleSendInvite = async (e: Event) => {
    e.preventDefault();
    const email = inviteEmail().trim().toLowerCase();

    if (!email) {
      setInviteError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setInviteError("Invalid email format");
      return;
    }

    if (members().some((m) => m.email.toLowerCase() === email)) {
      setInviteError("User is already a team member");
      return;
    }

    setSending(true);
    setInviteError("");

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole() }),
      });

      if (res.ok) {
        setInviteEmail("");
        setInviteRole("member");
        notify("success", `Invitation sent to ${email}`);
        await fetchInvitations();
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch {
      setInviteError("Failed to send invitation");
      notify("error", "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        notify("success", "Role updated");
        await fetchMembers();
      } else {
        notify("error", "Couldn't update the role");
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      notify("error", "Couldn't update the role");
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setConfirming({
      title: "Remove team member?",
      description: `${memberName} will lose access to this business immediately. This can't be undone.`,
      confirmLabel: "Remove member",
      action: async () => {
        try {
          const res = await fetch(`/api/team/members/${memberId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            notify("success", "Member removed");
            await fetchMembers();
          } else {
            notify("error", "Couldn't remove the member");
          }
        } catch (err) {
          console.error("Failed to remove member:", err);
          notify("error", "Couldn't remove the member");
        }
      },
    });
  };

  const handleCancelInvitation = (invitationId: string, email: string) => {
    setConfirming({
      title: "Cancel invitation?",
      description: `The invitation to ${email} will be revoked. They won't be able to join with that link.`,
      confirmLabel: "Cancel invitation",
      action: async () => {
        try {
          const res = await fetch(`/api/team/invitations/${invitationId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            notify("success", "Invitation cancelled");
            await fetchInvitations();
          } else {
            notify("error", "Couldn't cancel the invitation");
          }
        } catch (err) {
          console.error("Failed to cancel invitation:", err);
          notify("error", "Couldn't cancel the invitation");
        }
      },
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return ms > 0 && ms < 48 * 3600_000;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };

  return (
    <>
      {/* Section content only — the route wraps this in SettingsShell (DS §6
        shared template), which owns the H1, section nav, and page container. */}
      <div class="e1-enter flex w-full flex-col gap-6">
        {/* Invite Member Form */}
        <Show when={isAdmin() || isOwner()}>
          <section
            aria-labelledby="team-invite-heading"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="team-invite-heading"
              class="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground"
            >
              <UserPlus size={20} class="text-primary" aria-hidden="true" />
              Invite Team Member
            </h2>

            <form class="flex flex-col gap-4" onSubmit={handleSendInvite}>
              <div class="flex flex-col gap-3 sm:flex-row">
                <Field.Root class="flex-1">
                  <Field.Label
                    for="invite-email"
                    class="text-sm font-medium text-foreground"
                  >
                    Email Address
                  </Field.Label>
                  <Field.Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail()}
                    onInput={(e) => {
                      setInviteEmail(e.currentTarget.value);
                      setInviteError("");
                    }}
                    class={fieldInputClass}
                  />
                  <Show when={inviteError()}>
                    <Field.ErrorText class="mt-1 text-xs text-destructive">
                      {inviteError()}
                    </Field.ErrorText>
                  </Show>
                </Field.Root>

                <Field.Root class="w-full sm:w-40">
                  <Field.Label
                    for="invite-role"
                    class="text-sm font-medium text-foreground"
                  >
                    Role
                  </Field.Label>
                  <select
                    id="invite-role"
                    value={inviteRole()}
                    onChange={(e) =>
                      setInviteRole(e.currentTarget.value as UserRole)
                    }
                    class={selectClass}
                  >
                    <For each={ROLE_DEFINITIONS}>
                      {(r) => <option value={r.value}>{r.label}</option>}
                    </For>
                  </select>
                </Field.Root>
              </div>

              <button
                type="submit"
                disabled={sending()}
                class="inline-flex min-h-11 self-start items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-[180ms] hover:bg-primary-hover disabled:opacity-50 motion-reduce:transition-none"
              >
                {sending() ? "Sending..." : "Send Invitation"}
              </button>
            </form>
          </section>
        </Show>

        {/* Join Requests -- the actionable queue, so it sits above the roster */}
        <Show when={isAdmin() || isOwner()}>
          <section
            aria-labelledby="team-requests-heading"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="team-requests-heading"
              class="tnum mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground"
            >
              <UserPlus size={20} class="text-primary" aria-hidden="true" />
              Join Requests (
              {joinRequests().filter((r) => r.status === "pending").length})
            </h2>

            <Show when={joinForbidden()}>
              <p class="rounded-card border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                You don't have permission to review join requests. Only owners
                and admins can approve or reject them.
              </p>
            </Show>

            <Show
              when={joinRequests().length > 0}
              fallback={
                <Show when={!joinForbidden()}>
                  <EmptyState
                    icon={UserPlus}
                    title="All caught up"
                    description="No pending join requests. New requests from businesses looking to join will appear here."
                    class="border-0 p-4"
                  />
                </Show>
              }
            >
              <Show when={joinRequestError()}>
                <div
                  role="alert"
                  class="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-destructive/20 bg-destructive-muted px-4 py-3"
                >
                  <p class="min-w-0 flex-1 text-sm text-destructive">
                    {joinRequestError()}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchJoinRequests()}
                    class="inline-flex min-h-11 items-center rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
                  >
                    Retry
                  </button>
                </div>
              </Show>

              <div class="divide-y divide-border">
                <For each={joinRequests()}>
                  {(request) => (
                    <div class="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                      <div class="flex min-w-0 items-start gap-4">
                        <Show
                          when={request.user.image}
                          fallback={
                            <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                              {(request.user.name || request.user.email)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          }
                        >
                          <img
                            src={request.user.image ?? ""}
                            alt=""
                            class="size-10 shrink-0 rounded-full object-cover"
                          />
                        </Show>

                        <div class="min-w-0">
                          <p class="truncate font-medium text-foreground">
                            {request.user.name || request.user.email}
                          </p>
                          <p class="truncate text-sm text-muted-foreground">
                            {request.user.email}
                          </p>
                          <Show when={request.message}>
                            <p class="mt-2 rounded-card bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                              {request.message}
                            </p>
                          </Show>
                          <p class="tnum mt-1 text-xs text-muted-foreground">
                            Requested {formatDate(request.createdAt)}
                          </p>
                        </div>
                      </div>

                      <Show
                        when={request.status === "pending"}
                        fallback={
                          <span class="shrink-0">
                            <Badge
                              tone={
                                request.status === "approved"
                                  ? "success"
                                  : request.status === "rejected"
                                    ? "destructive"
                                    : "neutral"
                              }
                            >
                              {request.status === "approved"
                                ? `Approved as ${getRoleLabel(request.grantedRole ?? "member")}`
                                : request.status === "rejected"
                                  ? "Rejected"
                                  : "Cancelled"}
                              {request.reviewedBy
                                ? ` by ${request.reviewedBy.name || request.reviewedBy.email}`
                                : ""}
                            </Badge>
                          </span>
                        }
                      >
                        <div class="flex shrink-0 items-center gap-2">
                          <select
                            aria-label="Role to grant"
                            value={roleFor(request.id)}
                            onChange={(e) =>
                              setReviewRoles((prev) => ({
                                ...prev,
                                [request.id]: e.currentTarget.value as UserRole,
                              }))
                            }
                            disabled={reviewingId() === request.id}
                            class="rounded-control border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                          >
                            <For each={ROLE_DEFINITIONS}>
                              {(r) => (
                                <option value={r.value}>{r.label}</option>
                              )}
                            </For>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              handleReviewJoinRequest(request.id, "approve")
                            }
                            disabled={reviewingId() === request.id}
                            class="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-[180ms] hover:bg-primary-hover disabled:opacity-50 motion-reduce:transition-none"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleReviewJoinRequest(request.id, "reject")
                            }
                            disabled={reviewingId() === request.id}
                            class="inline-flex min-h-11 items-center rounded-control bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted/80 disabled:opacity-50 motion-reduce:transition-none"
                          >
                            Reject
                          </button>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>
        </Show>

        {/* Team Members */}
        <section
          aria-labelledby="team-members-heading"
          class="rounded-card border border-border bg-card p-6 shadow-sm"
        >
          <h2
            id="team-members-heading"
            class="tnum mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground"
          >
            <Users size={20} class="text-primary" aria-hidden="true" />
            Team Members ({members().length})
          </h2>

          <Show when={loading()}>
            <SkeletonRows count={3} />
          </Show>

          <Show when={!loading() && loadError() && members().length === 0}>
            <WidgetError
              message={loadError()}
              onRetry={() => fetchMembers()}
              retryLabel="Retry"
            />
          </Show>

          <Show when={!loading() && !loadError()}>
            <Show
              when={members().length > 0}
              fallback={
                <EmptyState
                  icon={Users}
                  title="No team members yet"
                  description="Invite colleagues by email to collaborate on reviews, bookings, and projects."
                  primaryLabel="Send an invite"
                  onPrimary={() =>
                    document.getElementById("invite-email")?.focus()
                  }
                />
              }
            >
              <DataTable
                caption="Team members with roles and join dates"
                columns={[
                  {
                    header: "Member",
                    render: (member) => (
                      <span class="flex items-center gap-3">
                        <Show
                          when={member.image}
                          fallback={
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          }
                        >
                          <img
                            src={member.image!}
                            alt={member.name}
                            class="size-9 shrink-0 rounded-full"
                          />
                        </Show>
                        <span class="min-w-0">
                          <span class="block truncate text-sm font-medium text-foreground">
                            {member.name}
                            {member.id === currentUserId() && (
                              <span class="ml-2 text-xs font-normal text-muted-foreground">
                                (You)
                              </span>
                            )}
                          </span>
                          <span class="block truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        </span>
                      </span>
                    ),
                  },
                  {
                    header: "Role",
                    render: (member) => (
                      <Show
                        when={
                          (isAdmin() || isOwner()) &&
                          member.id !== currentUserId()
                        }
                        fallback={
                          <span class="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            {getRoleLabel(member.role)}
                          </span>
                        }
                      >
                        <select
                          value={member.role}
                          aria-label={`Role for ${member.name}`}
                          onChange={(e) =>
                            handleUpdateRole(member.id, e.currentTarget.value)
                          }
                          class="h-9 rounded-control border border-input bg-background px-2 text-xs text-foreground"
                        >
                          <For each={ROLE_DEFINITIONS}>
                            {(r) => <option value={r.value}>{r.label}</option>}
                          </For>
                        </select>
                      </Show>
                    ),
                  },
                  {
                    header: "Joined",
                    render: (member) => (
                      <span class="tnum text-sm text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </span>
                    ),
                  },
                  {
                    header: "Actions",
                    render: (member) => (
                      <Show
                        when={
                          (isAdmin() || isOwner()) &&
                          member.id !== currentUserId()
                        }
                        fallback={
                          <span class="text-xs text-muted-foreground">—</span>
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMember(member.id, member.name)
                          }
                          aria-label={`Remove ${member.name} from the team`}
                          class="grid size-11 place-items-center rounded-control text-muted-foreground transition-opacity duration-[180ms] hover:bg-destructive/10 hover:text-destructive motion-reduce:transition-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Show>
                    ),
                  },
                ]}
                rows={members()}
                rowKey={(m) => m.id}
                renderCard={(member) => (
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {member.email} · {getRoleLabel(member.role)}
                      </p>
                    </div>
                    <Show
                      when={
                        (isAdmin() || isOwner()) &&
                        member.id !== currentUserId()
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveMember(member.id, member.name)
                        }
                        aria-label={`Remove ${member.name} from the team`}
                        class="grid size-11 shrink-0 place-items-center rounded-control text-muted-foreground transition-opacity duration-[180ms] hover:bg-destructive/10 hover:text-destructive motion-reduce:transition-none"
                      >
                        <Trash2 size={16} />
                      </button>
                    </Show>
                  </div>
                )}
              />
            </Show>
          </Show>
        </section>

        {/* Pending Invitations */}
        <Show when={invitations().length > 0}>
          <section
            aria-labelledby="team-invites-heading"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="team-invites-heading"
              class="tnum mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground"
            >
              <Clock
                size={20}
                class="text-muted-foreground"
                aria-hidden="true"
              />
              Invitations ({invitations().length})
            </h2>

            <div class="divide-y divide-border">
              <For each={invitations()}>
                {(invitation) => (
                  <div class="flex items-center justify-between gap-3 py-4">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-foreground">
                        {invitation.email}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        Invited by {invitation.invitedBy.name} as{" "}
                        {getRoleLabel(invitation.role)} ·{" "}
                        <span class="tnum">
                          expires {formatDate(invitation.expiresAt)}
                        </span>
                      </p>
                      <Show
                        when={
                          invitation.status === "pending" &&
                          isExpiringSoon(invitation.expiresAt)
                        }
                      >
                        <span class="mt-1 inline-block">
                          <Badge tone="warning" icon={Clock}>
                            Expiring soon
                          </Badge>
                        </span>
                      </Show>
                      <Show when={invitation.status === "declined"}>
                        <p class="mt-1 text-xs font-medium text-destructive">
                          Declined — they created their own business instead
                        </p>
                      </Show>
                    </div>

                    <Show
                      when={
                        (isAdmin() || isOwner()) &&
                        invitation.status !== "declined"
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleCancelInvitation(
                            invitation.id,
                            invitation.email,
                          )
                        }
                        class="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-xs font-medium text-muted-foreground transition-opacity duration-[180ms] hover:bg-destructive/10 hover:text-destructive motion-reduce:transition-none"
                      >
                        Cancel
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* Danger zone (DS §6): removing a member revokes their access
          immediately, so it lives here — separated, explained, and always
          behind the confirmation dialog below. Disconnecting Google lives in
          the Danger Zone on /settings. */}
        <Show when={isAdmin() || isOwner()}>
          <SectionCard
            id="section-danger"
            title="Danger Zone"
            icon={ShieldAlert}
          >
            <div class="flex flex-col gap-3 rounded-card border border-destructive/25 bg-destructive-muted p-4">
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-medium text-foreground">
                  Remove a team member
                </h3>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Removal takes effect immediately and can't be undone. Use the
                  remove button on a member's row — you'll be asked to confirm
                  before anything happens.
                </p>
              </div>
            </div>
          </SectionCard>
        </Show>
      </div>

      {/* Accessible destructive-action confirm (replaces native confirm()). */}
      <Dialog.Root
        open={confirming() !== null}
        onOpenChange={(d) => {
          if (!d.open && !confirmingBusy()) setConfirming(null);
        }}
      >
        <Portal>
          <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content class="e2-enter w-full max-w-md rounded-card border border-border bg-card p-6 shadow-lg">
              <div class="flex items-start gap-3">
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-destructive-muted text-destructive">
                  <AlertTriangle size={20} aria-hidden="true" />
                </span>
                <div>
                  <Dialog.Title class="font-heading text-lg font-semibold text-foreground">
                    {confirming()?.title}
                  </Dialog.Title>
                  <Dialog.Description class="mt-1 text-sm text-muted-foreground">
                    {confirming()?.description}
                  </Dialog.Description>
                </div>
              </div>
              <div class="mt-6 flex justify-end gap-2">
                <Dialog.CloseTrigger
                  disabled={confirmingBusy()}
                  class="h-11 rounded-control border border-border px-4 text-sm font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted disabled:opacity-50 motion-reduce:transition-none"
                >
                  Keep
                </Dialog.CloseTrigger>
                <Button
                  variant="destructive"
                  onClick={runConfirmed}
                  loading={confirmingBusy()}
                  loadingLabel="Working…"
                >
                  {confirming()?.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
