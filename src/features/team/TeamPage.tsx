import { Field } from "@ark-ui/solid/field";
import { Title } from "@solidjs/meta";
import Clock from "lucide-solid/icons/clock";
import Trash2 from "lucide-solid/icons/trash-2";
import UserPlus from "lucide-solid/icons/user-plus";
import Users from "lucide-solid/icons/users";
import { createSignal, For, onMount, Show } from "solid-js";
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
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

const selectClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10";

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
  const [reviewingId, setReviewingId] = createSignal<string | null>(null);
  const [reviewRoles, setReviewRoles] = createSignal<Record<string, UserRole>>(
    {},
  );

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
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
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
      // A plain member gets 403 here, which just leaves the queue empty and the
      // whole section unrendered -- same as the other fetchers.
      const res = await fetch("/api/team/join-requests");
      if (res.ok) {
        const data = await res.json();
        setJoinRequests(data);
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
    await Promise.all([
      fetchMembers(),
      fetchInvitations(),
      fetchBusiness(),
      fetchJoinRequests(),
    ]);
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
        await fetchInvitations();
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch {
      setInviteError("Failed to send invitation");
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
        await fetchMembers();
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) {
      return;
    }

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchMembers();
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchInvitations();
      }
    } catch (err) {
      console.error("Failed to cancel invitation:", err);
    }
  };

  return (
    <>
      <Title>Team Management</Title>

      <div class="flex-1 w-full max-w-4xl mx-auto p-6 flex flex-col gap-6 bg-background min-h-screen text-foreground">
        <section class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl shadow-sm border border-border">
          <div class="flex items-center gap-4">
            <Users size={24} class="text-primary" />
            <div>
              <h2 class="text-2xl font-bold font-heading text-foreground">
                Team Management
              </h2>
              <p class="text-sm text-muted-foreground">
                Manage your team members and their roles
              </p>
            </div>
          </div>
        </section>

        {/* Invite Member Form */}
        <Show when={isAdmin() || isOwner()}>
          <section class="bg-card p-6 rounded-xl shadow-sm border border-border">
            <h3 class="text-lg font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
              <UserPlus size={20} class="text-primary" />
              Invite Team Member
            </h3>

            <form class="flex flex-col gap-4" onSubmit={handleSendInvite}>
              <div class="flex gap-3">
                <Field.Root class="flex-1">
                  <Field.Label
                    for="invite-email"
                    class="text-sm font-semibold text-foreground"
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
                    <Field.ErrorText class="text-xs text-destructive mt-1">
                      {inviteError()}
                    </Field.ErrorText>
                  </Show>
                </Field.Root>

                <Field.Root class="w-40">
                  <Field.Label
                    for="invite-role"
                    class="text-sm font-semibold text-foreground"
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
                class="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {sending() ? "Sending..." : "Send Invitation"}
              </button>
            </form>
          </section>
        </Show>

        {/* Join Requests -- the actionable queue, so it sits above the roster */}
        <Show when={(isAdmin() || isOwner()) && joinRequests().length > 0}>
          <section class="bg-card p-6 rounded-xl shadow-sm border border-border">
            <h3 class="text-lg font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
              <UserPlus size={20} class="text-primary" />
              Join Requests (
              {joinRequests().filter((r) => r.status === "pending").length})
            </h3>

            <Show when={joinRequestError()}>
              <p role="alert" class="text-sm text-destructive mb-4">
                {joinRequestError()}
              </p>
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
                          <p class="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            {request.message}
                          </p>
                        </Show>
                        <p class="mt-1 text-xs text-muted-foreground">
                          Requested{" "}
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Show
                      when={request.status === "pending"}
                      fallback={
                        <p class="shrink-0 text-sm text-muted-foreground">
                          {request.status === "approved"
                            ? `Approved as ${getRoleLabel(request.grantedRole ?? "member")}`
                            : request.status === "rejected"
                              ? "Rejected"
                              : "Cancelled"}
                          {request.reviewedBy
                            ? ` by ${request.reviewedBy.name || request.reviewedBy.email}`
                            : ""}
                        </p>
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
                          class="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                        >
                          <For each={ROLE_DEFINITIONS}>
                            {(r) => <option value={r.value}>{r.label}</option>}
                          </For>
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            handleReviewJoinRequest(request.id, "approve")
                          }
                          disabled={reviewingId() === request.id}
                          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleReviewJoinRequest(request.id, "reject")
                          }
                          disabled={reviewingId() === request.id}
                          class="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* Team Members */}
        <section class="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h3 class="text-lg font-semibold font-heading text-foreground mb-4">
            Team Members ({members().length})
          </h3>

          <Show
            when={members().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground text-center py-4">
                No team members yet
              </p>
            }
          >
            <div class="divide-y divide-border">
              <For each={members()}>
                {(member) => (
                  <div class="flex items-center justify-between py-4">
                    <div class="flex items-center gap-4">
                      <Show
                        when={member.image}
                        fallback={
                          <span class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
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
                          class="w-10 h-10 rounded-full"
                        />
                      </Show>
                      <div>
                        <p class="text-sm font-medium text-foreground">
                          {member.name}
                          {member.id === currentUserId() && (
                            <span class="ml-2 text-xs text-muted-foreground">
                              (You)
                            </span>
                          )}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <Show
                        when={
                          (isAdmin() || isOwner()) &&
                          member.id !== currentUserId()
                        }
                      >
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.id, e.currentTarget.value)
                          }
                          class="text-xs rounded border border-input bg-background px-2 py-1 text-foreground"
                        >
                          <For each={ROLE_DEFINITIONS}>
                            {(r) => <option value={r.value}>{r.label}</option>}
                          </For>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          class="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Show>

                      <Show
                        when={
                          !(isAdmin() || isOwner()) ||
                          member.id === currentUserId()
                        }
                      >
                        <span class="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded">
                          {getRoleLabel(member.role)}
                        </span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        {/* Pending Invitations */}
        <Show when={invitations().length > 0}>
          <section class="bg-card p-6 rounded-xl shadow-sm border border-border">
            <h3 class="text-lg font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
              <Clock size={20} class="text-muted-foreground" />
              Invitations ({invitations().length})
            </h3>

            <div class="divide-y divide-border">
              <For each={invitations()}>
                {(invitation) => (
                  <div class="flex items-center justify-between py-4">
                    <div>
                      <p class="text-sm font-medium text-foreground">
                        {invitation.email}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        Invited by {invitation.invitedBy.name} as{" "}
                        {getRoleLabel(invitation.role)}
                      </p>
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
                        onClick={() => handleCancelInvitation(invitation.id)}
                        class="text-xs text-muted-foreground hover:text-destructive transition-colors"
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
      </div>
    </>
  );
}
