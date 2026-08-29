import { createSignal, onMount, For, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import Users from "lucide-solid/icons/users";
import UserPlus from "lucide-solid/icons/user-plus";
import Trash2 from "lucide-solid/icons/trash-2";
import Clock from "lucide-solid/icons/clock";
import { Field } from "@ark-ui/solid/field";
import { ROLE_DEFINITIONS, getRoleLabel, type UserRole } from "~/lib/roles";
import { authClient } from "~/lib/auth-client";

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

const fieldInputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

const selectClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10";

export default function TeamPage() {
  const session = authClient.useSession();
  const currentUserId = () => session()?.data?.user?.id;

  const [members, setMembers] = createSignal<TeamMember[]>([]);
  const [invitations, setInvitations] = createSignal<PendingInvitation[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [ownerId, setOwnerId] = createSignal<string | null>(null);

  const [inviteEmail, setInviteEmail] = createSignal("");
  const [inviteRole, setInviteRole] = createSignal<UserRole>("member");
  const [inviteError, setInviteError] = createSignal("");
  const [sending, setSending] = createSignal(false);

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
    await Promise.all([fetchMembers(), fetchInvitations(), fetchBusiness()]);
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
              <h2 class="text-2xl font-bold font-heading text-foreground">Team Management</h2>
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
                  <Field.Label for="invite-email" class="text-sm font-semibold text-foreground">
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
                  <Field.Label for="invite-role" class="text-sm font-semibold text-foreground">
                    Role
                  </Field.Label>
                  <select
                    id="invite-role"
                    value={inviteRole()}
                    onChange={(e) => setInviteRole(e.currentTarget.value as UserRole)}
                    class={selectClass}
                  >
                    <For each={ROLE_DEFINITIONS}>
                      {(r) => (
                        <option value={r.value}>{r.label}</option>
                      )}
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
                            <span class="ml-2 text-xs text-muted-foreground">(You)</span>
                          )}
                        </p>
                        <p class="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <Show when={(isAdmin() || isOwner()) && member.id !== currentUserId()}>
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.currentTarget.value)}
                          class="text-xs rounded border border-input bg-background px-2 py-1 text-foreground"
                        >
                          <For each={ROLE_DEFINITIONS}>
                            {(r) => (
                              <option value={r.value}>{r.label}</option>
                            )}
                          </For>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          class="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Show>

                      <Show when={!(isAdmin() || isOwner()) || member.id === currentUserId()}>
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
                        Invited by {invitation.invitedBy.name} as {getRoleLabel(invitation.role)}
                      </p>
                      <Show when={invitation.status === "declined"}>
                        <p class="mt-1 text-xs font-medium text-destructive">
                          Declined — they created their own business instead
                        </p>
                      </Show>
                    </div>

                    <Show when={(isAdmin() || isOwner()) && invitation.status !== "declined"}>
                      <button
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
