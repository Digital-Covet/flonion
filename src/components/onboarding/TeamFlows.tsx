import {
  IconArrowLeft,
  IconBuildings,
  IconClock,
  IconMail,
  IconSearch,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import {
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  textLink,
} from "~/components/auth/AuthShell";
import { cn } from "~/lib/cn";
import { getRoleLabel } from "~/lib/roles";
import {
  ActionBar,
  api,
  btnPrimary,
  btnSecondary,
  ConfirmDialog,
  cardClass,
  NETWORK_ERROR,
  Notice,
  Spinner,
  StepHeading,
  stepEnter,
} from "./ui";

export type Invitation = {
  id: string;
  token: string;
  role: string;
  expiresAt: string;
  business: { name: string };
  invitedBy: { name: string | null; email: string } | null;
};

export type OwnedBusiness = {
  id: string;
  name: string;
  empty: boolean;
  blockers: string[];
};

export type JoinRequest = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  createdAt: string;
  business: {
    id: string;
    name: string;
    username: string | null;
    logo: string | null;
  };
};

const MESSAGE_MAX = 300;

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function BusinessAvatar(props: { name: string; logo?: string | null }) {
  return (
    <Show
      when={props.logo}
      fallback={
        <span
          aria-hidden="true"
          class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-soft font-display text-lg font-semibold text-primary"
        >
          {props.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      }
    >
      {(src) => (
        <img
          src={src()}
          alt=""
          class="size-12 shrink-0 rounded-md border border-border object-cover"
        />
      )}
    </Show>
  );
}

/* --------------------------------------------------------------- chooser */

/** Two large cards: set up a business, or join a team. */
export function BranchChooser(props: {
  hasDraft: boolean;
  onSetup: () => void;
  onJoin: () => void;
}) {
  const option = (p: {
    icon: JSX.Element;
    title: string;
    body: string;
    cta: string;
    onClick: () => void;
    primary?: boolean;
  }) => (
    <button
      type="button"
      onClick={p.onClick}
      class={cn(
        "group flex w-full flex-col items-start gap-3 rounded-lg border bg-surface p-5 text-left transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-primary hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)] sm:p-6",
        p.primary ? "border-border-strong" : "border-border",
        focusRing,
      )}
    >
      <span class="grid size-11 place-items-center rounded-md bg-primary-soft text-primary">
        {p.icon}
      </span>
      <span class="font-display text-lg font-semibold text-text">
        {p.title}
      </span>
      <span class="text-base text-text-muted">{p.body}</span>
      <span class="mt-auto pt-1 text-sm font-medium text-primary underline-offset-4 group-hover:underline">
        {p.cta} →
      </span>
    </button>
  );

  return (
    <section aria-labelledby="ob-choose-title">
      <h2 id="ob-choose-title" class="sr-only">
        How do you want to start?
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        {option({
          icon: <IconBuildings aria-hidden="true" class="size-5" />,
          title: "Set up my business",
          body: "Create your review link and QR code. Takes about 5 minutes.",
          cta: props.hasDraft ? "Continue where you left off" : "Start setup",
          onClick: props.onSetup,
          primary: true,
        })}
        {option({
          icon: <IconUsers aria-hidden="true" class="size-5" />,
          title: "Join my team",
          body: "Your business already uses Flonion. Ask to join with its handle.",
          cta: "Find my team",
          onClick: props.onJoin,
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- invite */

export function InviteCard(props: {
  invitation: Invitation;
  ownedBusiness: OwnedBusiness | null;
  onDeclined: () => void;
}) {
  const [busy, setBusy] = createSignal<"accept" | "decline" | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [confirm, setConfirm] = createSignal<string | null>(null);

  const blocked = () => props.ownedBusiness && !props.ownedBusiness.empty;

  async function accept(confirmDeleteOwnedBusiness = false) {
    setBusy("accept");
    setError(null);
    try {
      const { ok, status, data } = await api<{
        requiresConfirmation: boolean;
      }>("/api/team/accept-invite", {
        method: "POST",
        body: { token: props.invitation.token, confirmDeleteOwnedBusiness },
      });
      if (ok) {
        window.location.assign("/dashboard");
        return;
      }
      if (status === 409 && data.requiresConfirmation) {
        setConfirm(data.error ?? "Accepting will delete your empty business.");
      } else {
        setConfirm(null);
        setError(data.error ?? "We couldn't accept the invitation.");
      }
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    setError(null);
    try {
      const { ok, data } = await api("/api/team/decline-invite", {
        method: "POST",
        body: { token: props.invitation.token },
      });
      if (ok) props.onDeclined();
      else setError(data.error ?? "We couldn't decline the invitation.");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }

  const inviter = () =>
    props.invitation.invitedBy?.name || props.invitation.invitedBy?.email;

  return (
    <section
      aria-labelledby="ob-invite-title"
      class={cn(cardClass, "border-primary/40")}
    >
      <div class="flex items-start gap-4">
        <span class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
          <IconMail aria-hidden="true" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-primary">Pending invitation</p>
          <h2
            id="ob-invite-title"
            class="font-display text-lg font-semibold text-balance text-text"
          >
            You've been invited to {props.invitation.business.name}
          </h2>
          <p class="mt-1 text-sm text-text-muted">
            Role:{" "}
            <span class="text-text">{getRoleLabel(props.invitation.role)}</span>
            <Show when={inviter()}>
              {" "}
              · Invited by <span class="text-text">{inviter()}</span>
            </Show>{" "}
            · Expires {formatDate(props.invitation.expiresAt)}
          </p>
        </div>
      </div>

      <Show when={blocked()}>
        <Notice tone="warning" class="mt-5">
          <p class="font-medium">
            You own “{props.ownedBusiness?.name}”, which already has data in it.
          </p>
          <p class="mt-1">
            An account that owns a business with data can't join a team:
          </p>
          <ul class="mt-1 list-disc pl-5">
            <For each={props.ownedBusiness?.blockers}>
              {(b) => <li>{b}</li>}
            </For>
          </ul>
        </Notice>
      </Show>
      <Show when={props.ownedBusiness?.empty}>
        <Notice tone="info" class="mt-5">
          Accepting will delete “{props.ownedBusiness?.name}”, the empty
          business you started. We'll ask you to confirm.
        </Notice>
      </Show>
      <Show when={error()}>
        <Notice tone="error" class="mt-5">
          {error()}
        </Notice>
      </Show>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy() !== null}
          onClick={decline}
          class={cn(btnSecondary, "disabled:cursor-progress")}
        >
          <Show when={busy() === "decline"}>
            <Spinner />
          </Show>
          Decline
        </button>
        <button
          type="button"
          disabled={busy() !== null || Boolean(blocked())}
          onClick={() => accept(false)}
          class={cn(
            btnPrimary,
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <Show when={busy() === "accept" && !confirm()}>
            <Spinner />
          </Show>
          Accept and join
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(confirm())}
        title="Delete your empty business?"
        description={confirm() ?? ""}
        confirmLabel="Delete and join"
        pending={busy() === "accept"}
        onConfirm={() => accept(true)}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}

/* ----------------------------------------------------------------- join */

type FoundBusiness = {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  sector: string | null;
  address: string | null;
};

type Lookup =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "found"; business: FoundBusiness }
  | { kind: "none" }
  | { kind: "ambiguous" };

export function JoinTeam(props: {
  onBack: () => void;
  onRequested: (request: JoinRequest) => void;
  onAlreadyMember: () => void;
}) {
  const [handle, setHandle] = createSignal("");
  const [lookup, setLookup] = createSignal<Lookup>({ kind: "idle" });
  const [handleError, setHandleError] = createSignal<string>();
  const [message, setMessage] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal<{
    text: string;
    blockers?: string[];
  }>();
  const [confirm, setConfirm] = createSignal<string | null>(null);
  let handleRef: HTMLInputElement | undefined;

  async function find(event: SubmitEvent) {
    event.preventDefault();
    const value = handle().trim();
    setError(undefined);
    if (!value) {
      setHandleError("Enter your team's handle or exact business name.");
      handleRef?.focus();
      return;
    }
    setHandleError(undefined);
    setLookup({ kind: "searching" });
    try {
      const { ok, status, data } = await api<{
        business: FoundBusiness | null;
        ambiguous: boolean;
      }>(`/api/team/find-business?handle=${encodeURIComponent(value)}`);
      if (status === 409) return props.onAlreadyMember();
      if (!ok) {
        setLookup({ kind: "idle" });
        setHandleError(data.error ?? "We couldn't search right now.");
        return;
      }
      if (data.ambiguous) setLookup({ kind: "ambiguous" });
      else if (data.business)
        setLookup({ kind: "found", business: data.business });
      else setLookup({ kind: "none" });
    } catch {
      setLookup({ kind: "idle" });
      setHandleError(NETWORK_ERROR);
    }
  }

  async function request(
    business: FoundBusiness,
    confirmDeleteOwnedBusiness = false,
  ) {
    if (sending()) return;
    setSending(true);
    setError(undefined);
    try {
      const { ok, status, data } = await api<{
        id: string;
        createdAt: string;
        requiresConfirmation: boolean;
        blockers: string[];
      }>("/api/team/join-request", {
        method: "POST",
        body: {
          businessId: business.id,
          message: message().trim() || undefined,
          confirmDeleteOwnedBusiness,
        },
      });
      if (ok && data.id) {
        setConfirm(null);
        props.onRequested({
          id: data.id,
          status: "pending",
          createdAt: data.createdAt ?? new Date().toISOString(),
          business: {
            id: business.id,
            name: business.name,
            username: business.username,
            logo: business.logo,
          },
        });
        return;
      }
      if (status === 409 && data.requiresConfirmation) {
        setConfirm(data.error ?? "Joining will delete your empty business.");
        return;
      }
      setConfirm(null);
      setError({
        text: data.error ?? "We couldn't send your request.",
        blockers: data.blockers,
      });
    } catch {
      setError({ text: NETWORK_ERROR });
    } finally {
      setSending(false);
    }
  }

  return (
    <div class={stepEnter("forward")}>
      <form novalidate onSubmit={find} class={cardClass}>
        <StepHeading
          title="Find your team"
          lead="Ask your owner or admin for the team handle. It's the name in their review link: /company/handle/review."
          focusOnMount
        />

        <div class="mt-6 flex flex-col gap-1.5">
          <label for="ob-handle" class={labelClass}>
            Team handle or exact business name
          </label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              ref={handleRef}
              id="ob-handle"
              type="search"
              autocapitalize="none"
              autocomplete="off"
              spellcheck={false}
              maxlength={80}
              placeholder="swaad"
              value={handle()}
              onInput={(e) => {
                setHandle(e.currentTarget.value);
                setHandleError(undefined);
              }}
              aria-invalid={Boolean(handleError())}
              aria-describedby={handleError() ? "ob-handle-error" : undefined}
              class={cn(inputBase, "flex-1")}
            />
            <button
              type="submit"
              disabled={lookup().kind === "searching"}
              class={cn(btnSecondary, "disabled:cursor-progress")}
            >
              <Show
                when={lookup().kind === "searching"}
                fallback={<IconSearch aria-hidden="true" class="size-4" />}
              >
                <Spinner class="size-4" />
              </Show>
              Find team
            </button>
          </div>
          <FieldError id="ob-handle-error" message={handleError()} />
        </div>

        <div aria-live="polite" class="mt-5">
          <Switch>
            <Match when={lookup().kind === "none"}>
              <Notice tone="warning">
                We couldn't find a team called “{handle().trim()}”. Check the
                spelling with your team, or use their handle instead.
              </Notice>
            </Match>
            <Match when={lookup().kind === "ambiguous"}>
              <Notice tone="warning">
                More than one business has that name. Ask your team for their
                handle instead.
              </Notice>
            </Match>
            <Match
              when={(() => {
                const l = lookup();
                return l.kind === "found" ? l.business : undefined;
              })()}
            >
              {(business) => (
                <div class="rounded-md border border-border bg-background p-4">
                  <div class="flex items-center gap-3">
                    <BusinessAvatar
                      name={business().name}
                      logo={business().logo}
                    />
                    <div class="min-w-0">
                      <p class="font-display text-base font-semibold text-text">
                        {business().name}
                      </p>
                      <p class="truncate text-sm text-text-muted">
                        <Show when={business().username}>
                          <span class="font-mono">@{business().username}</span>
                        </Show>
                        <For
                          each={[business().sector, business().address].filter(
                            Boolean,
                          )}
                        >
                          {(part) => <> · {part}</>}
                        </For>
                      </p>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-col gap-1.5">
                    <label for="ob-join-message" class={labelClass}>
                      Message to the team{" "}
                      <span class="font-normal text-text-muted">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      id="ob-join-message"
                      rows={2}
                      maxlength={MESSAGE_MAX}
                      placeholder="Hi, I'm the new front-desk manager."
                      value={message()}
                      onInput={(e) => setMessage(e.currentTarget.value)}
                      class={cn(inputBase, "min-h-20 resize-y py-2.5")}
                    />
                    <p class="text-right font-mono text-xs text-text-muted tabular-nums">
                      {message().length}/{MESSAGE_MAX}
                    </p>
                  </div>

                  <Show when={error()}>
                    {(err) => (
                      <Notice tone="error" class="mt-3">
                        <p>{err().text}</p>
                        <Show when={err().blockers?.length}>
                          <ul class="mt-1 list-disc pl-5">
                            <For each={err().blockers}>
                              {(b) => <li>{b}</li>}
                            </For>
                          </ul>
                        </Show>
                      </Notice>
                    )}
                  </Show>

                  <button
                    type="button"
                    disabled={sending()}
                    onClick={() => request(business())}
                    class={cn(
                      btnPrimary,
                      "mt-4 w-full disabled:cursor-progress disabled:opacity-80",
                    )}
                  >
                    <Show
                      when={sending() && !confirm()}
                      fallback={
                        <IconUserPlus aria-hidden="true" class="size-4" />
                      }
                    >
                      <Spinner class="size-4" />
                    </Show>
                    Request to join
                  </button>

                  <ConfirmDialog
                    open={Boolean(confirm())}
                    title="Delete your empty business?"
                    description={confirm() ?? ""}
                    confirmLabel="Delete and send request"
                    pending={sending()}
                    onConfirm={() => request(business(), true)}
                    onClose={() => setConfirm(null)}
                  />
                </div>
              )}
            </Match>
          </Switch>
        </div>

        <ActionBar>
          <button type="button" onClick={props.onBack} class={btnSecondary}>
            <IconArrowLeft aria-hidden="true" class="size-4" />
            Back
          </button>
        </ActionBar>
      </form>
    </div>
  );
}

/* --------------------------------------------------------- join status */

const POLL_MS = 15_000;

/**
 * Waiting / rejected card. Polls while the tab is visible so an approval
 * moves the user straight to the dashboard.
 */
export function JoinStatus(props: {
  request: JoinRequest;
  onChange: (request: JoinRequest | null) => void;
  onCreateOwn: () => void;
  onAskAnother: () => void;
}) {
  const [withdrawing, setWithdrawing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const pending = () => props.request.status === "pending";

  async function refresh() {
    if (!pending() || document.visibilityState !== "visible") return;
    try {
      const { ok, data } = await api<{
        request: JoinRequest | null;
        joined: boolean;
      }>("/api/team/join-request");
      if (!ok) return;
      if (data.joined) {
        window.location.assign("/dashboard");
        return;
      }
      if (data.request && data.request.status !== props.request.status)
        props.onChange(data.request);
    } catch {}
  }

  onMount(() => {
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    onCleanup(() => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    });
  });

  async function withdraw() {
    setWithdrawing(true);
    setError(null);
    try {
      const { ok, status, data } = await api("/api/team/join-request", {
        method: "DELETE",
      });
      if (ok || status === 404) props.onChange(null);
      else setError(data.error ?? "We couldn't withdraw your request.");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <section class={cn(cardClass, stepEnter("forward"))}>
      <div class="flex items-center gap-3">
        <BusinessAvatar
          name={props.request.business.name}
          logo={props.request.business.logo}
        />
        <div class="min-w-0">
          <p class="font-display text-base font-semibold text-text">
            {props.request.business.name}
          </p>
          <Show when={props.request.business.username}>
            <p class="font-mono text-sm text-text-muted">
              @{props.request.business.username}
            </p>
          </Show>
        </div>
      </div>

      <div class="mt-6" aria-live="polite">
        <Switch>
          <Match when={pending()}>
            <p class="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary">
              <IconClock aria-hidden="true" class="size-4" />
              Waiting for approval
            </p>
            <StepHeading
              title="Request sent"
              lead="We emailed the team's owner and admins. You'll get access as soon as someone approves it. This page updates on its own."
              focusOnMount
            />
            <p class="mt-2 text-sm text-text-muted">
              Sent {formatDate(props.request.createdAt)}
            </p>
          </Match>
          <Match when={props.request.status === "rejected"}>
            <Notice tone="error">
              <span class="font-medium">
                {props.request.business.name} declined your request.
              </span>{" "}
              You can ask again in 24 hours, ask a different team, or set up
              your own business.
            </Notice>
          </Match>
        </Switch>
      </div>

      <Show when={error()}>
        <Notice tone="error" class="mt-4">
          {error()}
        </Notice>
      </Show>

      <ActionBar>
        <Show
          when={pending()}
          fallback={
            <>
              <button
                type="button"
                onClick={props.onAskAnother}
                class={btnSecondary}
              >
                Ask another team
              </button>
              <button
                type="button"
                onClick={props.onCreateOwn}
                class={cn(btnPrimary, "ml-auto flex-1 sm:flex-none")}
              >
                Set up my business
              </button>
            </>
          }
        >
          <button
            type="button"
            disabled={withdrawing()}
            onClick={withdraw}
            class={cn(btnSecondary, "disabled:cursor-progress")}
          >
            <Show when={withdrawing()}>
              <Spinner />
            </Show>
            Withdraw request
          </button>
          <button
            type="button"
            onClick={props.onCreateOwn}
            class={cn("ml-auto min-h-11 px-2 text-sm", textLink)}
          >
            Create my own business instead
          </button>
        </Show>
      </ActionBar>
    </section>
  );
}
