import { A, useSearchParams } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconClockX,
  IconLinkOff,
  IconLogin,
  IconLogout,
  IconMail,
  IconRefresh,
  IconUserCheck,
  IconUsersGroup,
  IconUserX,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  For,
  type JSX,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { AuthShell } from "~/components/auth/AuthShell";
import { PageMeta } from "~/components/meta/PageMeta";
import {
  createInviteActions,
  type Invitation,
  type OwnedBusiness,
} from "~/components/onboarding/TeamFlows";
import {
  api,
  btnPrimary,
  btnSecondary,
  ConfirmDialog,
  NETWORK_ERROR,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { pickInviteToken, withInvite } from "~/lib/invite-redirect";
import { getRoleDescription, getRoleLabel } from "~/lib/roles";

/** Mirrors `InviteState` in /api/team/check-invite. */
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

type CheckResponse = {
  state: InviteState;
  invitation: Invitation | null;
  ownedBusiness: OwnedBusiness | null;
  account: { email: string; onboardingCompleted: boolean };
};

type Kind =
  | InviteState
  | "loading"
  | "error"
  | "signed_out"
  | "joined"
  | "declined_now";

type Tone = "primary" | "success" | "warning" | "error" | "neutral";

const TONE_TILE: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  neutral: "border border-border bg-background text-text-muted",
};

const btnFull = "w-full sm:w-auto";

function formatExpiry(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = () => pickInviteToken(params.token);

  const [kind, setKind] = createSignal<Kind>("loading");
  const [data, setData] = createSignal<CheckResponse | null>(null);
  // Only moves focus after something the user did; on first load the
  // browser's own focus handling is left alone.
  const [announce, setAnnounce] = createSignal(false);
  const [switching, setSwitching] = createSignal(false);

  const go = (next: Kind) => {
    setAnnounce(true);
    setKind(next);
  };

  const { busy, error, confirm, setConfirm, accept, decline } =
    createInviteActions({
      token: () => token() ?? "",
      onAccepted: () => {
        go("joined");
        window.location.assign("/dashboard");
      },
      onDeclined: () => go("declined_now"),
    });

  async function load() {
    const value = token();
    if (!value) {
      setKind("invalid");
      return;
    }
    setKind("loading");
    try {
      const {
        ok,
        status,
        data: body,
      } = await api<CheckResponse>(`/api/team/check-invite?token=${value}`);
      if (status === 401) {
        setKind("signed_out");
        return;
      }
      if (!ok || !body.state || !body.account) {
        setKind("error");
        return;
      }
      setData(body as CheckResponse);
      setKind(body.state);
    } catch {
      setKind("error");
    }
  }

  onMount(load);

  async function switchAccount() {
    setSwitching(true);
    await authClient.signOut().catch(() => {});
    window.location.assign(withInvite("/login", token()));
  }

  const invitation = () => data()?.invitation ?? null;
  const owned = () => data()?.ownedBusiness ?? null;
  const blocked = () => Boolean(owned() && !owned()?.empty);
  const business = () => invitation()?.business.name ?? "the team";
  const inviter = () =>
    invitation()?.invitedBy?.name ||
    invitation()?.invitedBy?.email ||
    "the person who invited you";

  /** Where to go when this invitation leads nowhere. */
  const next = () =>
    data()?.account.onboardingCompleted
      ? { href: "/dashboard", label: "Go to dashboard" }
      : { href: "/onboarding", label: "Set up my business" };

  const nextLink = (primary = false) => (
    <A
      href={next().href}
      class={cn(primary ? btnPrimary : btnSecondary, btnFull)}
    >
      {next().label}
    </A>
  );

  const Header = (p: {
    tone: Tone;
    icon: JSX.Element;
    eyebrow?: string;
    title: string;
    children: JSX.Element;
  }) => (
    <div class="flex flex-col items-start gap-4">
      <span
        class={cn(
          "grid size-12 shrink-0 place-items-center rounded-md",
          TONE_TILE[p.tone],
        )}
      >
        {p.icon}
      </span>
      <div>
        <Show when={p.eyebrow}>
          <p class="font-display text-sm font-semibold tracking-wide text-primary uppercase">
            {p.eyebrow}
          </p>
        </Show>
        <h1
          ref={(el) => {
            if (announce()) queueMicrotask(() => el.focus());
          }}
          tabindex="-1"
          class="mt-1 font-display text-xl font-semibold text-balance text-text outline-none"
        >
          {p.title}
        </h1>
        <p class="mt-2 text-base text-pretty text-text-muted">{p.children}</p>
      </div>
    </div>
  );

  const Actions = (p: { children: JSX.Element }) => (
    <div class="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {p.children}
    </div>
  );

  const icon = (Icon: typeof IconMail) => (
    <Icon aria-hidden="true" class="size-6" />
  );

  return (
    <>
      <PageMeta title="Accept invitation" path="/accept-invite" noindex />

      <AuthShell
        skipTo="invite-card"
        skipLabel="Skip to invitation"
        aside={
          <Show when={data()?.account.email}>
            {(email) => (
              <>
                Signed in as{" "}
                <span class="font-medium break-all text-text">{email()}</span>
              </>
            )}
          </Show>
        }
      >
        <div id="invite-card">
          <Switch>
            <Match when={kind() === "loading"}>
              <div aria-busy="true" class="flex flex-col gap-4">
                <span class="sr-only">Checking your invitation…</span>
                <div class="size-12 rounded-md bg-primary-soft motion-safe:animate-pulse" />
                <div class="h-6 w-3/4 rounded-sm bg-primary-soft motion-safe:animate-pulse" />
                <div class="h-4 w-full rounded-sm bg-primary-soft/70 motion-safe:animate-pulse" />
                <div class="mt-2 h-36 rounded-md border border-border bg-background motion-safe:animate-pulse" />
                <div class="mt-4 h-11 rounded-md bg-primary-soft/70 motion-safe:animate-pulse" />
              </div>
            </Match>

            <Match when={kind() === "signed_out"}>
              <Header
                tone="primary"
                icon={icon(IconMail)}
                eyebrow="Team invitation"
                title="You've been invited to a team on Flonion"
              >
                Log in with the email address this invitation was sent to. New
                here? Create an account with that address and you'll come
                straight back to this page.
              </Header>
              <Actions>
                <A
                  href={withInvite("/signup", token())}
                  class={cn(btnSecondary, btnFull)}
                >
                  Create an account
                </A>
                <A
                  href={withInvite("/login", token())}
                  class={cn(btnPrimary, btnFull)}
                >
                  <IconLogin aria-hidden="true" class="size-4" />
                  Log in to accept
                </A>
              </Actions>
            </Match>

            <Match when={kind() === "pending" && invitation()}>
              {(inv) => (
                <>
                  <Header
                    tone="primary"
                    icon={icon(IconUsersGroup)}
                    eyebrow="Team invitation"
                    title={`Join ${inv().business.name} on Flonion`}
                  >
                    {inviter()} invited you to collect reviews and reply to
                    customers together.
                  </Header>

                  <dl class="mt-6 divide-y divide-border rounded-md border border-border bg-background text-sm">
                    <div class="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                      <dt class="shrink-0 text-text-muted sm:w-24">Team</dt>
                      <dd class="min-w-0 font-medium break-words text-text">
                        {inv().business.name}
                      </dd>
                    </div>
                    <div class="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                      <dt class="shrink-0 text-text-muted sm:w-24">
                        Your role
                      </dt>
                      <dd class="min-w-0 text-text">
                        <span class="font-medium">
                          {getRoleLabel(inv().role)}
                        </span>
                        <Show when={getRoleDescription(inv().role)}>
                          {(desc) => (
                            <span class="block text-text-muted">{desc()}</span>
                          )}
                        </Show>
                      </dd>
                    </div>
                    <Show when={inv().invitedBy}>
                      {(by) => (
                        <div class="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                          <dt class="shrink-0 text-text-muted sm:w-24">
                            Invited by
                          </dt>
                          <dd class="min-w-0 text-text">
                            <span class="font-medium">
                              {by().name || by().email}
                            </span>
                            <Show when={by().name}>
                              <span class="block break-all text-text-muted">
                                {by().email}
                              </span>
                            </Show>
                          </dd>
                        </div>
                      )}
                    </Show>
                    <div class="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                      <dt class="shrink-0 text-text-muted sm:w-24">Expires</dt>
                      <dd class="min-w-0 text-text">
                        <time datetime={inv().expiresAt}>
                          {formatExpiry(inv().expiresAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>

                  <Show when={blocked()}>
                    <Notice tone="warning" class="mt-5">
                      <p class="font-medium">
                        You own “{owned()?.name}”, which already has data in it.
                      </p>
                      <p class="mt-1">
                        An account that owns a business with data can't join a
                        team:
                      </p>
                      <ul class="mt-1 list-disc pl-5">
                        <For each={owned()?.blockers}>
                          {(b) => <li>{b}</li>}
                        </For>
                      </ul>
                    </Notice>
                  </Show>
                  <Show when={owned()?.empty}>
                    <Notice tone="info" class="mt-5">
                      Accepting will delete “{owned()?.name}”, the empty
                      business you started. We'll ask you to confirm first.
                    </Notice>
                  </Show>
                  <Show when={error()}>
                    <Notice tone="error" class="mt-5">
                      {error()}
                    </Notice>
                  </Show>

                  <Actions>
                    <Show when={!blocked()} fallback={nextLink()}>
                      <button
                        type="button"
                        disabled={busy() !== null}
                        onClick={decline}
                        class={cn(
                          btnSecondary,
                          btnFull,
                          "disabled:cursor-progress",
                        )}
                      >
                        <Show when={busy() === "decline"}>
                          <Spinner class="size-4" />
                        </Show>
                        Decline
                      </button>
                    </Show>
                    <button
                      type="button"
                      disabled={busy() !== null || blocked()}
                      onClick={() => accept(false)}
                      class={cn(
                        btnPrimary,
                        btnFull,
                        "disabled:cursor-not-allowed disabled:opacity-60",
                      )}
                    >
                      <Show when={busy() === "accept" && !confirm()}>
                        <Spinner class="size-4" />
                      </Show>
                      Accept and join
                    </button>
                  </Actions>

                  <ConfirmDialog
                    open={Boolean(confirm())}
                    title="Delete your empty business?"
                    description={confirm() ?? ""}
                    confirmLabel="Delete and join"
                    pending={busy() === "accept"}
                    onConfirm={() => accept(true)}
                    onClose={() => setConfirm(null)}
                  />
                </>
              )}
            </Match>

            <Match when={kind() === "joined"}>
              <Header
                tone="success"
                icon={icon(IconCircleCheck)}
                title={`Welcome to ${business()}`}
              >
                You're on the team. Taking you to your dashboard…
              </Header>
              <Actions>
                <A href="/dashboard" class={cn(btnPrimary, btnFull)}>
                  <Spinner class="size-4" />
                  Go to dashboard
                </A>
              </Actions>
            </Match>

            <Match when={kind() === "declined_now"}>
              <Header
                tone="neutral"
                icon={icon(IconUserX)}
                title="Invitation declined"
              >
                You won't join {business()}. Changed your mind? Ask {inviter()}{" "}
                to invite you again.
              </Header>
              <Actions>{nextLink(true)}</Actions>
            </Match>

            <Match when={kind() === "already_member"}>
              <Header
                tone="success"
                icon={icon(IconUserCheck)}
                title={`You're already on the ${business()} team`}
              >
                This invitation has been accepted. There's nothing more to do.
              </Header>
              <Actions>
                <A href="/dashboard" class={cn(btnPrimary, btnFull)}>
                  Go to dashboard
                </A>
              </Actions>
            </Match>

            <Match when={kind() === "wrong_account"}>
              <Header
                tone="warning"
                icon={icon(IconAlertTriangle)}
                title="This invitation is for a different account"
              >
                You're signed in as{" "}
                <span class="font-medium break-all text-text">
                  {data()?.account.email}
                </span>
                . Log out, then log in or sign up with the address the
                invitation was sent to.
              </Header>
              <Actions>
                {nextLink()}
                <button
                  type="button"
                  disabled={switching()}
                  onClick={switchAccount}
                  class={cn(btnPrimary, btnFull, "disabled:cursor-progress")}
                >
                  <Show
                    when={switching()}
                    fallback={<IconLogout aria-hidden="true" class="size-4" />}
                  >
                    <Spinner class="size-4" />
                  </Show>
                  Log out and switch account
                </button>
              </Actions>
            </Match>

            <Match when={kind() === "in_other_team"}>
              <Header
                tone="warning"
                icon={icon(IconAlertTriangle)}
                title="You're already part of another team"
              >
                An account can belong to one team at a time. To join{" "}
                {business()}, ask your current team's owner to remove you, then
                open this link again.
              </Header>
              <Actions>
                <A href="/dashboard" class={cn(btnPrimary, btnFull)}>
                  Go to dashboard
                </A>
              </Actions>
            </Match>

            <Match when={kind() === "expired"}>
              <Header
                tone="warning"
                icon={icon(IconClockX)}
                title="This invitation has expired"
              >
                Invitations last 7 days. Ask {inviter()} at {business()} to send
                you a new one.
              </Header>
              <Actions>{nextLink(true)}</Actions>
            </Match>

            <Match when={kind() === "used"}>
              <Header
                tone="neutral"
                icon={icon(IconUserCheck)}
                title="This invitation has already been used"
              >
                It was accepted earlier. If you've since left {business()}, ask{" "}
                {inviter()} for a new invitation.
              </Header>
              <Actions>{nextLink(true)}</Actions>
            </Match>

            <Match when={kind() === "declined"}>
              <Header
                tone="neutral"
                icon={icon(IconUserX)}
                title="You declined this invitation"
              >
                Changed your mind? Ask {inviter()} at {business()} to send a new
                one.
              </Header>
              <Actions>{nextLink(true)}</Actions>
            </Match>

            <Match when={kind() === "cancelled"}>
              <Header
                tone="neutral"
                icon={icon(IconBan)}
                title="This invitation was withdrawn"
              >
                {business()} cancelled it. If you think that's a mistake,
                contact {inviter()}.
              </Header>
              <Actions>{nextLink(true)}</Actions>
            </Match>

            <Match when={kind() === "invalid"}>
              <Header
                tone="neutral"
                icon={icon(IconLinkOff)}
                title="This invitation link isn't valid"
              >
                The link may be incomplete. Open it again from your email, or
                ask your team to send a new invitation.
              </Header>
              <Actions>
                <A href="/" class={cn(btnPrimary, btnFull)}>
                  Go to Flonion home
                </A>
              </Actions>
            </Match>

            <Match when={kind() === "error"}>
              <Header
                tone="error"
                icon={icon(IconAlertTriangle)}
                title="We couldn't load this invitation"
              >
                {NETWORK_ERROR}
              </Header>
              <Actions>
                <button
                  type="button"
                  onClick={() => {
                    setAnnounce(true);
                    load();
                  }}
                  class={cn(btnPrimary, btnFull)}
                >
                  <IconRefresh aria-hidden="true" class="size-4" />
                  Try again
                </button>
              </Actions>
            </Match>
          </Switch>
        </div>
      </AuthShell>
    </>
  );
}
