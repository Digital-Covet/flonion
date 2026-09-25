import { A } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconMailForward,
} from "@tabler/icons-solidjs";
import { createSignal, type JSX, Show } from "solid-js";
import {
  AccountPanel,
  FactRow,
  Requirement,
  StatusChip,
} from "~/components/account/ui";
import {
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  PasswordInput,
  textLink,
} from "~/components/auth/AuthShell";
import {
  btnPrimary,
  btnSecondary,
  NETWORK_ERROR,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import { authClient } from "~/lib/auth-client";
import {
  authErrorCode,
  isRateLimitError,
  isRejectedEmailError,
  RATE_LIMIT_MESSAGE,
  REJECTED_EMAIL_MESSAGE,
} from "~/lib/auth-errors";
import { cn } from "~/lib/cn";

/** Same floor and ceiling as signup and reset-password. */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Panel-wide action: full width on phones, auto on desktop. */
const panelAction = "min-h-11 w-full px-4 text-sm sm:w-auto";

/* ───────────────────────────── email ───────────────────────────── */

/**
 * Changing the email is a request, not a save: better-auth mails a
 * verification link to the *new* address and only swaps the address once that
 * link is opened. The panel says so plainly, because an owner who sees "saved"
 * and then can't log in with the new address has been lied to.
 */
export function EmailPanel(props: {
  email: string;
  verified: boolean;
  focusHeading?: boolean;
}) {
  const [value, setValue] = createSignal("");
  const [fieldError, setFieldError] = createSignal<string>();
  const [banner, setBanner] = createSignal<{
    tone: "error" | "success";
    text: string;
  }>();
  const [sentTo, setSentTo] = createSignal<string>();
  const [pending, setPending] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;

  function reset() {
    setSentTo(undefined);
    setBanner(undefined);
    setValue("");
    queueMicrotask(() => inputRef?.focus());
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending()) return;

    const next = value().trim();
    if (!next) {
      setFieldError("Enter the address you want to move to.");
      inputRef?.focus();
      return;
    }
    if (!EMAIL_SHAPE.test(next)) {
      setFieldError("Enter an email address like name@business.com.");
      inputRef?.focus();
      return;
    }
    if (next.toLowerCase() === props.email.toLowerCase()) {
      setFieldError("That's already your email address.");
      inputRef?.focus();
      return;
    }

    setFieldError(undefined);
    setBanner(undefined);
    setPending(true);
    try {
      const { error } = await authClient.changeEmail({
        newEmail: next,
        // Back here after the link is opened, with the section already open.
        callbackURL: "/account?section=email",
      });
      if (error) {
        if (isRateLimitError(error)) {
          setBanner({ tone: "error", text: RATE_LIMIT_MESSAGE });
          return;
        }
        if (isRejectedEmailError(error)) {
          setFieldError(REJECTED_EMAIL_MESSAGE);
          inputRef?.focus();
          return;
        }
        setBanner({
          tone: "error",
          text: "We couldn't start that change. Try again shortly.",
        });
        return;
      }
      setSentTo(next);
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountPanel
      id="email"
      title="Email address"
      lead="This is where verification links, review alerts and invitations go."
      focusHeading={props.focusHeading}
    >
      <div class="flex flex-col gap-6">
        <div>
          <FactRow label="Current address">
            <span class="break-all">{props.email}</span>
          </FactRow>
          <FactRow
            label="Status"
            hint={
              props.verified
                ? undefined
                : "Until it's verified we can't send you review alerts."
            }
          >
            <Show
              when={props.verified}
              fallback={
                <StatusChip tone="warning" icon={IconAlertTriangle}>
                  Not verified
                </StatusChip>
              }
            >
              <StatusChip tone="success" icon={IconCircleCheck}>
                Verified
              </StatusChip>
            </Show>
          </FactRow>
        </div>

        <Show
          when={!sentTo()}
          fallback={
            <div class="flex flex-col items-start gap-4">
              <Notice tone="success" class="w-full">
                <p>
                  <span class="font-medium">Check {sentTo()}.</span> Open the
                  link in that email to finish the change.
                </p>
                <p class="mt-1 text-text-muted">
                  You'll keep logging in with{" "}
                  <span class="break-all">{props.email}</span> until you do. The
                  link expires, so if it goes stale just start again.
                </p>
              </Notice>
              <button
                type="button"
                onClick={reset}
                class={cn(btnSecondary, panelAction)}
              >
                Use a different address
              </button>
            </div>
          }
        >
          <form
            novalidate
            onSubmit={submit}
            class="flex flex-col items-start gap-4"
          >
            <Show when={banner()}>
              {(note) => (
                <Notice tone={note().tone} class="w-full">
                  {note().text}
                </Notice>
              )}
            </Show>

            <div class="flex w-full flex-col gap-1.5 sm:max-w-md">
              <label for="account-new-email" class={labelClass}>
                New email address
              </label>
              <input
                ref={inputRef}
                id="account-new-email"
                name="new-email"
                type="email"
                inputmode="email"
                autocomplete="email"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                required
                placeholder="name@business.com"
                value={value()}
                onInput={(event) => {
                  setValue(event.currentTarget.value);
                  setFieldError(undefined);
                }}
                aria-invalid={Boolean(fieldError())}
                aria-describedby={cn(
                  "account-new-email-hint",
                  fieldError() && "account-new-email-error",
                )}
                class={inputBase}
              />
              <p id="account-new-email-hint" class="text-sm text-text-muted">
                We'll send a verification link there. Nothing changes until you
                open it.
              </p>
              <FieldError id="account-new-email-error" message={fieldError()} />
            </div>

            <button
              type="submit"
              disabled={pending()}
              aria-disabled={pending()}
              class={cn(
                btnPrimary,
                panelAction,
                "disabled:cursor-progress disabled:opacity-80",
              )}
            >
              <Show
                when={pending()}
                fallback={
                  <>
                    <IconMailForward aria-hidden="true" class="size-4" />
                    Send verification link
                  </>
                }
              >
                <Spinner class="size-4" />
                Sending…
              </Show>
            </button>
          </form>
        </Show>
      </div>
    </AccountPanel>
  );
}

/* ──────────────────────────── password ──────────────────────────── */

type PasswordField = "current" | "next" | "confirm";

/**
 * Password change. "Log out everywhere else" defaults on: the usual reason to
 * change a password is that someone else may know it, and leaving the other
 * sessions alive would defeat the change.
 */
export function PasswordPanel(props: { focusHeading?: boolean }) {
  const [current, setCurrent] = createSignal("");
  const [next, setNext] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [revokeOthers, setRevokeOthers] = createSignal(true);
  const [errors, setErrors] = createSignal<
    Partial<Record<PasswordField, string>>
  >({});
  const [banner, setBanner] = createSignal<{
    tone: "error" | "success";
    text: JSX.Element;
  }>();
  const [pending, setPending] = createSignal(false);

  const refs: Partial<Record<PasswordField, HTMLInputElement>> = {};

  const longEnough = () => next().length >= MIN_PASSWORD;
  const matches = () => next().length > 0 && next() === confirm();

  function clearField(field: PasswordField) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function fail(field: PasswordField, message: string) {
    setErrors((prev) => ({ ...prev, [field]: message }));
    refs[field]?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending()) return;

    const found: Partial<Record<PasswordField, string>> = {};
    if (!current()) found.current = "Enter your current password.";
    if (!next()) found.next = "Choose a new password.";
    else if (next().length < MIN_PASSWORD)
      found.next = `Use at least ${MIN_PASSWORD} characters.`;
    else if (next().length > MAX_PASSWORD)
      found.next = `Use ${MAX_PASSWORD} characters or fewer.`;
    else if (next() === current())
      found.next = "Choose a password you haven't used here before.";
    if (!confirm()) found.confirm = "Type the new password again.";
    else if (confirm() !== next()) found.confirm = "These don't match.";

    const first = (["current", "next", "confirm"] as const).find(
      (field) => found[field],
    );
    if (first) {
      setErrors(found);
      setBanner(undefined);
      refs[first]?.focus();
      return;
    }

    setErrors({});
    setBanner(undefined);
    setPending(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current(),
        newPassword: next(),
        revokeOtherSessions: revokeOthers(),
      });
      if (error) {
        const code = authErrorCode(error);
        if (code === "INVALID_PASSWORD") {
          fail("current", "That isn't your current password.");
          return;
        }
        if (code === "PASSWORD_TOO_SHORT") {
          fail("next", `Use at least ${MIN_PASSWORD} characters.`);
          return;
        }
        if (code === "PASSWORD_TOO_LONG") {
          fail("next", `Use ${MAX_PASSWORD} characters or fewer.`);
          return;
        }
        if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
          setBanner({
            tone: "error",
            text: "This account doesn't have a password yet. Use the reset link to set one.",
          });
          return;
        }
        if (isRateLimitError(error)) {
          setBanner({ tone: "error", text: RATE_LIMIT_MESSAGE });
          return;
        }
        setBanner({
          tone: "error",
          text: "We couldn't change your password. Try again shortly.",
        });
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setBanner({
        tone: "success",
        text: revokeOthers()
          ? "Password changed. Every other device has been logged out."
          : "Password changed. Other devices are still logged in.",
      });
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountPanel
      id="password"
      title="Password"
      lead="Use a password you don't use anywhere else."
      focusHeading={props.focusHeading}
    >
      <form
        novalidate
        onSubmit={submit}
        class="flex max-w-md flex-col items-start gap-5"
      >
        <Show when={banner()}>
          {(note) => (
            <Notice tone={note().tone} class="w-full">
              {note().text}
            </Notice>
          )}
        </Show>

        <div class="flex w-full flex-col gap-1.5">
          <label for="account-current-password" class={labelClass}>
            Current password
          </label>
          <PasswordInput
            ref={(el) => {
              refs.current = el;
            }}
            id="account-current-password"
            name="current-password"
            autocomplete="current-password"
            required
            maxlength={MAX_PASSWORD}
            value={current()}
            onInput={(event) => {
              setCurrent(event.currentTarget.value);
              clearField("current");
            }}
            aria-invalid={Boolean(errors().current)}
            aria-describedby={
              errors().current ? "account-current-password-error" : undefined
            }
          />
          <FieldError
            id="account-current-password-error"
            message={errors().current}
          />
          <p class="text-sm text-text-muted">
            Can't remember it?{" "}
            <A href="/forgot-password" class={textLink}>
              Reset it by email
            </A>
            .
          </p>
        </div>

        <div class="flex w-full flex-col gap-1.5">
          <label for="account-new-password" class={labelClass}>
            New password
          </label>
          <PasswordInput
            ref={(el) => {
              refs.next = el;
            }}
            id="account-new-password"
            name="new-password"
            autocomplete="new-password"
            required
            minlength={MIN_PASSWORD}
            maxlength={MAX_PASSWORD}
            value={next()}
            onInput={(event) => {
              setNext(event.currentTarget.value);
              clearField("next");
            }}
            aria-invalid={Boolean(errors().next)}
            aria-describedby={cn(
              "account-new-password-hint",
              errors().next && "account-new-password-error",
            )}
          />
          <Requirement id="account-new-password-hint" met={longEnough()}>
            At least {MIN_PASSWORD} characters
          </Requirement>
          <FieldError id="account-new-password-error" message={errors().next} />
        </div>

        <div class="flex w-full flex-col gap-1.5">
          <label for="account-confirm-password" class={labelClass}>
            Confirm new password
          </label>
          <PasswordInput
            ref={(el) => {
              refs.confirm = el;
            }}
            id="account-confirm-password"
            name="confirm-password"
            autocomplete="new-password"
            required
            maxlength={MAX_PASSWORD}
            value={confirm()}
            onInput={(event) => {
              setConfirm(event.currentTarget.value);
              clearField("confirm");
            }}
            aria-invalid={Boolean(errors().confirm)}
            aria-describedby={cn(
              "account-confirm-password-hint",
              errors().confirm && "account-confirm-password-error",
            )}
          />
          <Requirement id="account-confirm-password-hint" met={matches()}>
            Both passwords match
          </Requirement>
          <FieldError
            id="account-confirm-password-error"
            message={errors().confirm}
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              name="revoke-other-sessions"
              checked={revokeOthers()}
              onChange={(event) => setRevokeOthers(event.currentTarget.checked)}
              class={cn(
                "size-5 cursor-pointer rounded-sm border-border-strong accent-[var(--primary)]",
                focusRing,
              )}
            />
            Log out everywhere else
          </label>
          <p class="text-sm text-text-muted">
            Ends every other session — phones, tablets and shared computers.
            This device stays logged in.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending()}
          aria-disabled={pending()}
          class={cn(
            btnPrimary,
            panelAction,
            "disabled:cursor-progress disabled:opacity-80",
          )}
        >
          <Show when={pending()} fallback="Change password">
            <Spinner class="size-4" />
            Changing…
          </Show>
        </button>
      </form>
    </AccountPanel>
  );
}
