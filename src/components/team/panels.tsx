import {
  IconClock,
  IconCrown,
  IconMail,
  IconMailPlus,
  IconSend,
  IconUserCheck,
  IconUserMinus,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
  IconUserX,
} from "@tabler/icons-solidjs";
import { createSignal, For, type JSX, Show } from "solid-js";
import { FieldError, inputBase, labelClass } from "~/components/auth/AuthShell";
import { SkeletonRows, WidgetError } from "~/components/dashboard/ui";
import {
  btnPrimary,
  btnSecondary,
  ConfirmDialog,
  Notice,
  SelectField,
  Spinner,
} from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { SettingsSection } from "~/components/settings/ui";
import {
  cancelInvitation,
  changeMemberRole,
  expiryLabel,
  formatDate,
  inviteEmailProblem,
  isExpired,
  isPending,
  pendingFirst,
  personName,
  ROLE_OPTIONS,
  removeMember,
  reviewJoinRequest,
  sendInvitation,
  sortMembers,
  type TeamInvitation,
  type TeamJoinRequest,
  type TeamMemberRow,
} from "~/components/team/data";
import { cn } from "~/lib/cn";
import { getRoleLabel } from "~/lib/roles";

/**
 * The three queues of `/settings/team` (spec §6: "team table with role select
 * (owner/admin only), invitations and join-request queues").
 *
 * Rows are stacked cards rather than a table: owners read this on a phone
 * between customers, and a horizontally scrolling table would hide the very
 * actions the page exists for (spec §1, anti-pattern 5).
 */

/** What every panel needs from the page: its rows, and how to reload them. */
type PanelShell = {
  focusHeading?: boolean;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Reload the affected lists and announce the change politely. */
  onDone: (announcement: string) => void;
};

// ─── Small parts ─────────────────────────────────────────────────────────

/** Avatar, or the first letter when someone never uploaded a picture. */
function PersonAvatar(props: { name: string; image?: string | null }) {
  return (
    <Show
      when={props.image}
      fallback={
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-base font-semibold text-primary"
        >
          {props.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      }
    >
      {(src) => (
        <img
          src={src()}
          alt=""
          class="size-10 shrink-0 rounded-full border border-border object-cover"
        />
      )}
    </Show>
  );
}

/**
 * Status is always an icon plus a word — colour alone fails WCAG 1.4.1 and is
 * ambiguous for a colour-blind owner (spec §1, anti-pattern 4).
 */
function StatusChip(props: {
  tone: "neutral" | "success" | "error" | "muted";
  icon: typeof IconClock;
  children: JSX.Element;
}) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        props.tone === "neutral" && "bg-primary-soft text-primary",
        props.tone === "success" && "bg-success/10 text-success",
        props.tone === "error" && "bg-error/10 text-error",
        props.tone === "muted" && "bg-background text-text-muted",
      )}
    >
      <props.icon aria-hidden="true" class="size-3.5" />
      {props.children}
    </span>
  );
}

/** One person: picture, name, address, and whatever chips belong to the row. */
function PersonLine(props: {
  name: string;
  email: string;
  image?: string | null;
  chips?: JSX.Element;
  meta?: JSX.Element;
}) {
  return (
    <div class="flex min-w-0 flex-1 items-start gap-3">
      <PersonAvatar name={props.name} image={props.image} />
      <div class="min-w-0">
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-text">
          <span class="truncate">{props.name}</span>
          {props.chips}
        </p>
        <p class="truncate text-sm text-text-muted">{props.email}</p>
        <Show when={props.meta}>
          <p class="mt-0.5 text-sm text-text-muted">{props.meta}</p>
        </Show>
      </div>
    </div>
  );
}

const rowClass =
  "flex flex-col gap-3 border-b border-border py-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4";

/** Actions sit under the person on a phone, beside them from sm up. */
const rowActions = "flex flex-wrap items-center gap-2 sm:justify-end";

const smallButton = "min-h-11 px-3 text-sm";

/** One list, one loading shape, one failure, so a panel never loses the page. */
function PanelBody(props: {
  shell: PanelShell;
  what: string;
  rows: number;
  children: JSX.Element;
}) {
  return (
    <Show
      when={!props.shell.failed}
      fallback={<WidgetError what={props.what} onRetry={props.shell.onRetry} />}
    >
      <Show
        when={!props.shell.loading}
        fallback={<SkeletonRows rows={props.rows} label={props.what} />}
      >
        {props.children}
      </Show>
    </Show>
  );
}

// ─── Members ─────────────────────────────────────────────────────────────

export function MembersPanel(
  props: PanelShell & {
    members: TeamMemberRow[];
    viewerId: string;
    canManage: boolean;
    /** Jump to the invitations section; only offered to owners and admins. */
    onInvite?: () => void;
  },
) {
  const [busy, setBusy] = createSignal<string | null>(null);
  const [problem, setProblem] = createSignal<string>();
  const [confirm, setConfirm] = createSignal<TeamMemberRow | null>(null);

  const rows = () => sortMembers(props.members, props.viewerId);
  const confirmName = () => {
    const member = confirm();
    return member ? personName(member) : "this member";
  };

  /**
   * The owner's row and the signed-in user's own row carry no controls: the
   * server refuses both ("The business owner cannot be modified", "Cannot
   * remove yourself"), and an admin who could demote themselves would lock
   * themselves out of this page.
   */
  const editable = (member: TeamMemberRow) =>
    props.canManage && !member.isOwner && member.id !== props.viewerId;

  async function setRole(member: TeamMemberRow, role: string) {
    if (!role || role === member.role || busy()) return;
    setBusy(member.id);
    setProblem(undefined);
    const result = await changeMemberRole(member.id, role);
    setBusy(null);
    if (result.ok) {
      props.onDone(
        `${personName(member)} is now ${getRoleLabel(role).toLowerCase()}`,
      );
    } else {
      setProblem(result.message);
    }
  }

  async function remove() {
    const member = confirm();
    if (!member || busy()) return;
    setBusy(member.id);
    setProblem(undefined);
    const result = await removeMember(member.id);
    setBusy(null);
    setConfirm(null);
    if (result.ok) {
      props.onDone(`${personName(member)} was removed from the team`);
    } else {
      setProblem(result.message);
    }
  }

  return (
    <SettingsSection
      id="team-members"
      title="Team members"
      lead={
        props.loading || props.failed
          ? "Everyone who can sign in to this business."
          : `${props.members.length} ${props.members.length === 1 ? "person" : "people"} can sign in to this business.`
      }
      focusHeading={props.focusHeading}
      aside={
        <Show when={props.canManage && props.onInvite}>
          <button
            type="button"
            onClick={() => props.onInvite?.()}
            class={cn(btnSecondary, smallButton)}
          >
            <IconUserPlus aria-hidden="true" class="size-4" />
            Invite someone
          </button>
        </Show>
      }
    >
      <Show when={problem()}>
        {(message) => (
          <Notice tone="error" class="mb-4">
            {message()}
          </Notice>
        )}
      </Show>

      <PanelBody shell={props} what="your team" rows={3}>
        <Show
          when={rows().length}
          fallback={
            <EmptyState icon={IconUsers} title="It's just you so far">
              Invite the people who answer reviews with you, and they'll show up
              here.
            </EmptyState>
          }
        >
          <ul class="flex flex-col">
            <For each={rows()}>
              {(member) => (
                <li class={rowClass}>
                  <PersonLine
                    name={personName(member)}
                    email={member.email}
                    image={member.image}
                    chips={
                      <>
                        <Show when={member.isOwner}>
                          <StatusChip tone="neutral" icon={IconCrown}>
                            Owner
                          </StatusChip>
                        </Show>
                        <Show when={member.id === props.viewerId}>
                          <StatusChip tone="muted" icon={IconUserCheck}>
                            You
                          </StatusChip>
                        </Show>
                      </>
                    }
                    meta={<>Joined {formatDate(member.createdAt)}</>}
                  />

                  <div class={rowActions}>
                    <Show
                      when={editable(member)}
                      fallback={
                        <span class="rounded-full bg-background px-2.5 py-1 text-sm text-text-muted">
                          {getRoleLabel(member.role)}
                        </span>
                      }
                    >
                      <SelectField
                        label={`Role for ${personName(member)}`}
                        hideLabel
                        options={ROLE_OPTIONS}
                        value={member.role}
                        disabled={busy() === member.id}
                        onChange={(role) => setRole(member, role)}
                        class="w-full sm:w-44"
                      />
                      <button
                        type="button"
                        disabled={busy() === member.id}
                        onClick={() => setConfirm(member)}
                        class={cn(
                          btnSecondary,
                          smallButton,
                          "disabled:cursor-progress disabled:opacity-80",
                        )}
                      >
                        <Show
                          when={busy() === member.id}
                          fallback={
                            <IconUserMinus aria-hidden="true" class="size-4" />
                          }
                        >
                          <Spinner class="size-4" />
                        </Show>
                        Remove
                      </button>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </PanelBody>

      <ConfirmDialog
        open={Boolean(confirm())}
        title={`Remove ${confirmName()}?`}
        description="They lose access to this business straight away, and their tasks and replies stay. You can invite them again at any time."
        confirmLabel="Remove from team"
        pending={busy() !== null && busy() === confirm()?.id}
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </SettingsSection>
  );
}

// ─── Invitations ─────────────────────────────────────────────────────────

export function InvitationsPanel(
  props: PanelShell & { invitations: TeamInvitation[] },
) {
  const [email, setEmail] = createSignal("");
  const [role, setRole] = createSignal("member");
  const [fieldError, setFieldError] = createSignal<string>();
  const [problem, setProblem] = createSignal<string>();
  const [sent, setSent] = createSignal<string>();
  const [sending, setSending] = createSignal(false);
  const [cancelling, setCancelling] = createSignal<string | null>(null);

  const rows = () => pendingFirst(props.invitations);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (sending()) return;

    const problemWithEmail = inviteEmailProblem(email());
    setFieldError(problemWithEmail);
    if (problemWithEmail) {
      document.getElementById("team-invite-email")?.focus();
      return;
    }

    setSending(true);
    setProblem(undefined);
    setSent(undefined);
    const address = email().trim();
    const result = await sendInvitation(address, role());
    setSending(false);

    if (result.ok) {
      setEmail("");
      setSent(address);
      props.onDone(`Invitation sent to ${address}`);
    } else {
      setProblem(result.message);
    }
  }

  async function cancel(invitation: TeamInvitation) {
    if (cancelling()) return;
    setCancelling(invitation.id);
    setProblem(undefined);
    const result = await cancelInvitation(invitation.id);
    setCancelling(null);
    if (result.ok) props.onDone(`Invitation to ${invitation.email} cancelled`);
    else setProblem(result.message);
  }

  return (
    <SettingsSection
      id="team-invitations"
      title="Invitations"
      lead="Invite someone by email. They join your team as soon as they accept."
      focusHeading={props.focusHeading}
    >
      <form
        novalidate
        onSubmit={send}
        class="flex flex-col gap-4 border-b border-border pb-6"
      >
        <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div class="flex flex-col gap-1.5">
            <label for="team-invite-email" class={labelClass}>
              Email address
            </label>
            <input
              id="team-invite-email"
              type="email"
              inputmode="email"
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              placeholder="teammate@business.com"
              value={email()}
              disabled={sending()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                setFieldError(undefined);
              }}
              aria-invalid={Boolean(fieldError())}
              aria-describedby={
                fieldError() ? "team-invite-email-error" : undefined
              }
              class={inputBase}
            />
            <FieldError id="team-invite-email-error" message={fieldError()} />
          </div>
          <SelectField
            label="Role"
            options={ROLE_OPTIONS}
            value={role()}
            disabled={sending()}
            onChange={setRole}
          />
        </div>

        <Show when={sent()}>
          {(address) => (
            <Notice tone="success">
              Invitation sent to <span class="font-medium">{address()}</span>.
              The link works for 7 days.
            </Notice>
          )}
        </Show>
        <Show when={problem()}>
          {(message) => <Notice tone="error">{message()}</Notice>}
        </Show>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={sending()}
            class={cn(
              btnPrimary,
              "disabled:cursor-progress disabled:opacity-80",
            )}
          >
            <Show
              when={sending()}
              fallback={
                <>
                  <IconSend aria-hidden="true" class="size-5" />
                  Send invitation
                </>
              }
            >
              <Spinner />
              Sending…
            </Show>
          </button>
          <p class="text-sm text-text-muted">
            They'll get an email from Flonion with a link to accept.
          </p>
        </div>
      </form>

      <div class="mt-6">
        {/* A label rather than a heading: the empty state below carries its own,
            and an h3 above it would leave the outline jumping back to h2. */}
        <p
          id="team-invitations-sent"
          class="font-display text-base font-semibold text-text"
        >
          Sent invitations
        </p>

        <div class="mt-3">
          <PanelBody shell={props} what="your invitations" rows={2}>
            <Show
              when={rows().length}
              fallback={
                <EmptyState icon={IconMailPlus} title="No invitations waiting">
                  Invitations you send appear here until they're accepted,
                  declined, or expire.
                </EmptyState>
              }
            >
              <ul aria-labelledby="team-invitations-sent" class="flex flex-col">
                <For each={rows()}>
                  {(invitation) => {
                    const expired = () => isExpired(invitation);
                    const inviter = () =>
                      invitation.invitedBy?.name || invitation.invitedBy?.email;
                    return (
                      <li class={rowClass}>
                        <div class="flex min-w-0 flex-1 items-start gap-3">
                          <span
                            aria-hidden="true"
                            class="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"
                          >
                            <IconMail class="size-5" />
                          </span>
                          <div class="min-w-0">
                            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-text">
                              <span class="truncate">{invitation.email}</span>
                              <Show
                                when={isPending(invitation)}
                                fallback={
                                  <StatusChip tone="error" icon={IconUserX}>
                                    Declined
                                  </StatusChip>
                                }
                              >
                                <Show
                                  when={expired()}
                                  fallback={
                                    <StatusChip tone="neutral" icon={IconClock}>
                                      Pending
                                    </StatusChip>
                                  }
                                >
                                  <StatusChip tone="muted" icon={IconClock}>
                                    Expired
                                  </StatusChip>
                                </Show>
                              </Show>
                            </p>
                            <p class="text-sm text-text-muted">
                              {getRoleLabel(invitation.role)} · Sent{" "}
                              {formatDate(invitation.createdAt)}
                              <Show when={inviter()}> by {inviter()}</Show>
                            </p>
                            <Show when={isPending(invitation)}>
                              <p class="mt-0.5 text-sm text-text-muted">
                                {expiryLabel(invitation)}
                              </p>
                            </Show>
                          </div>
                        </div>

                        <div class={rowActions}>
                          <Show when={isPending(invitation)}>
                            <button
                              type="button"
                              disabled={cancelling() === invitation.id}
                              onClick={() => cancel(invitation)}
                              class={cn(
                                btnSecondary,
                                smallButton,
                                "disabled:cursor-progress disabled:opacity-80",
                              )}
                            >
                              <Show when={cancelling() === invitation.id}>
                                <Spinner class="size-4" />
                              </Show>
                              Cancel
                              <span class="sr-only">
                                {" "}
                                invitation to {invitation.email}
                              </span>
                            </button>
                          </Show>
                        </div>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </PanelBody>
        </div>
      </div>
    </SettingsSection>
  );
}

// ─── Join requests ───────────────────────────────────────────────────────

export function JoinRequestsPanel(
  props: PanelShell & { requests: TeamJoinRequest[] },
) {
  /** Role picked per request, so approving grants what the admin chose. */
  const [roles, setRoles] = createSignal<Record<string, string>>({});
  const [busy, setBusy] = createSignal<string | null>(null);
  const [problem, setProblem] = createSignal<string>();

  const rows = () => pendingFirst(props.requests);
  const roleFor = (id: string) => roles()[id] ?? "member";

  async function review(
    request: TeamJoinRequest,
    action: "approve" | "reject",
  ) {
    if (busy()) return;
    setBusy(request.id);
    setProblem(undefined);
    const result = await reviewJoinRequest(
      request.id,
      action,
      action === "approve" ? roleFor(request.id) : undefined,
    );
    setBusy(null);
    if (result.ok) {
      props.onDone(
        action === "approve"
          ? `${personName(request.user)} joined the team`
          : `Request from ${personName(request.user)} was rejected`,
      );
    } else {
      setProblem(result.message);
    }
  }

  return (
    <SettingsSection
      id="team-requests"
      title="Join requests"
      lead="People who found your business and asked to join it."
      focusHeading={props.focusHeading}
    >
      <Show when={problem()}>
        {(message) => (
          <Notice tone="error" class="mb-4">
            {message()}
          </Notice>
        )}
      </Show>

      <PanelBody shell={props} what="join requests" rows={2}>
        <Show
          when={rows().length}
          fallback={
            <EmptyState icon={IconUserQuestion} title="No one is waiting">
              When someone searches for your business and asks to join, their
              request lands here for you to approve.
            </EmptyState>
          }
        >
          <ul class="flex flex-col">
            <For each={rows()}>
              {(request) => (
                <li class="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 last:pb-0">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <PersonLine
                      name={personName(request.user)}
                      email={request.user.email}
                      image={request.user.image}
                      chips={
                        <>
                          <Show when={isPending(request)}>
                            <StatusChip tone="neutral" icon={IconClock}>
                              Waiting
                            </StatusChip>
                          </Show>
                          <Show when={request.status === "approved"}>
                            <StatusChip tone="success" icon={IconUserCheck}>
                              Approved
                              <Show when={request.grantedRole}>
                                {" "}
                                as {getRoleLabel(request.grantedRole ?? "")}
                              </Show>
                            </StatusChip>
                          </Show>
                          <Show when={request.status === "rejected"}>
                            <StatusChip tone="error" icon={IconUserX}>
                              Rejected
                            </StatusChip>
                          </Show>
                          <Show when={request.status === "cancelled"}>
                            <StatusChip tone="muted" icon={IconUserX}>
                              Withdrawn
                            </StatusChip>
                          </Show>
                        </>
                      }
                      meta={
                        <>
                          Asked {formatDate(request.createdAt)}
                          <Show
                            when={!isPending(request) && request.reviewedBy}
                          >
                            {" "}
                            · Reviewed by{" "}
                            {request.reviewedBy?.name ||
                              request.reviewedBy?.email}
                          </Show>
                        </>
                      }
                    />

                    <Show when={isPending(request)}>
                      <div class={cn(rowActions, "shrink-0")}>
                        <SelectField
                          label={`Role for ${personName(request.user)}`}
                          hideLabel
                          options={ROLE_OPTIONS}
                          value={roleFor(request.id)}
                          disabled={busy() === request.id}
                          onChange={(value) =>
                            setRoles((r) => ({ ...r, [request.id]: value }))
                          }
                          class="w-full sm:w-44"
                        />
                        <button
                          type="button"
                          disabled={busy() === request.id}
                          onClick={() => review(request, "reject")}
                          class={cn(
                            btnSecondary,
                            smallButton,
                            "disabled:cursor-progress disabled:opacity-80",
                          )}
                        >
                          Reject
                          <span class="sr-only">
                            {" "}
                            request from {personName(request.user)}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={busy() === request.id}
                          onClick={() => review(request, "approve")}
                          class={cn(
                            btnPrimary,
                            smallButton,
                            "disabled:cursor-progress disabled:opacity-80",
                          )}
                        >
                          <Show
                            when={busy() === request.id}
                            fallback={
                              <IconUserPlus aria-hidden="true" class="size-4" />
                            }
                          >
                            <Spinner class="size-4" />
                          </Show>
                          Approve
                          <span class="sr-only">
                            {" "}
                            request from {personName(request.user)}
                          </span>
                        </button>
                      </div>
                    </Show>
                  </div>

                  <Show when={request.message?.trim()}>
                    {(message) => (
                      <p class="rounded-md border-l-2 border-border-strong bg-background px-3 py-2 text-sm text-pretty text-text-muted sm:ml-13">
                        “{message()}”
                      </p>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </PanelBody>
    </SettingsSection>
  );
}

/** Shown to members: the two managed queues answer 403, so they aren't asked for. */
export function MemberOnlyNotice() {
  return (
    <Notice tone="info">
      Only the business owner and admins can invite people, change roles, or
      review join requests. You can see who is on the team.
    </Notice>
  );
}
