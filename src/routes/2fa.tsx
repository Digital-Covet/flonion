import { PinInput, usePinInput } from "@ark-ui/solid/pin-input";
import { Meta, Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
  IconClockHour3,
  IconLoader2,
  IconMail,
  IconShieldLock,
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
  AuthShell,
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  submitClass,
  textLink,
} from "~/components/auth/AuthShell";
import { authClient } from "~/lib/auth-client";
import { authErrorCode, isRateLimitError } from "~/lib/auth-errors";
import { cn } from "~/lib/cn";
import { takeTwoFactorDestination } from "~/lib/post-login-redirect";

/** better-auth generates 6 digits for both TOTP and emailed OTP. */
const CODE_LENGTH = 6;

/** Backup codes are `abc12-DE34f`: case-sensitive, so never upper-case them. */
const BACKUP_CODE_MAX = 32;

/** Long enough that a slow inbox isn't a wall, short enough not to feel stuck. */
const RESEND_SECONDS = 30;

type Mode = "totp" | "otp" | "backup";

type Notice =
  | { kind: "error"; message: string }
  | { kind: "locked" }
  | { kind: "rate-limit" };

const COPY: Record<
  Mode,
  { lead: string; label: string; hint: string; submit: string }
> = {
  totp: {
    lead: "Open your authenticator app and enter the 6-digit code for Flonion.",
    label: "Authentication code",
    hint: "The code changes every 30 seconds.",
    submit: "Verify and continue",
  },
  otp: {
    lead: "We emailed you a 6-digit code. It expires a few minutes after it's sent.",
    label: "Emailed code",
    hint: "Check your spam folder if it hasn't arrived.",
    submit: "Verify and continue",
  },
  backup: {
    lead: "Enter one of the backup codes you saved when you turned on two-step verification.",
    label: "Backup code",
    hint: "Each code works once, and codes are case-sensitive.",
    submit: "Use backup code",
  },
};

/**
 * Second factor for a sign-in already in flight (spec §6, auth set): the
 * better-auth client redirects here with `twoFactorPage` once a password
 * check passes and the account has 2FA on.
 *
 * Three ways in, because losing a phone must not lose the account: the
 * authenticator app (TOTP), a code emailed on request (OTP), and a saved
 * backup code. All three post to the same pending challenge, so the page
 * only swaps its input and its verb.
 */
export default function TwoFactorPage() {
  const navigate = useNavigate();

  const [mode, setMode] = createSignal<Mode>("totp");
  const [backupCode, setBackupCode] = createSignal("");
  const [trustDevice, setTrustDevice] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [cooldown, setCooldown] = createSignal(0);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [status, setStatus] = createSignal("");
  const [fieldError, setFieldError] = createSignal<string>();
  /** The challenge cookie is gone: nothing on this page can recover it. */
  const [expired, setExpired] = createSignal(false);

  let noticeRef: HTMLDivElement | undefined;
  let backupRef: HTMLInputElement | undefined;
  let expiredHeadingRef: HTMLHeadingElement | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const copy = () => COPY[mode()];

  const pin = usePinInput(() => ({
    id: "two-factor-code",
    count: CODE_LENGTH,
    // Lets iOS and Android offer the code straight from the SMS/email sheet.
    otp: true,
    type: "numeric" as const,
    placeholder: "",
    invalid: Boolean(fieldError()),
    disabled: pending(),
    blurOnComplete: false,
    translations: {
      inputLabel: (index: number, length: number) =>
        `Digit ${index + 1} of ${length}`,
    },
    // Typing the sixth digit is the submit gesture on a phone; the button
    // stays for keyboard, paste and screen-reader users.
    onValueComplete: (details: { valueAsString: string }) => {
      void verify(details.valueAsString);
    },
    // Only a fresh keystroke clears the error. Testing for content matters:
    // rejecting a code clears the boxes, and an unguarded handler would wipe
    // the message we just wrote in the same tick.
    onValueChange: (details: { valueAsString: string }) => {
      if (details.valueAsString.length > 0) setFieldError(undefined);
    },
  }));

  onMount(() => {
    pin().focus();
  });

  onCleanup(() => clearInterval(timer));

  function startCooldown() {
    setCooldown(RESEND_SECONDS);
    clearInterval(timer);
    timer = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }

  function showNotice(next: Notice) {
    setNotice(next);
    queueMicrotask(() => noticeRef?.focus());
  }

  /** Clear the wrong code so the next attempt starts from an empty field. */
  function resetCode() {
    pin().clearValue();
    setBackupCode("");
    queueMicrotask(() => {
      if (mode() === "backup") backupRef?.focus();
      else pin().focus();
    });
  }

  function switchTo(next: Mode) {
    if (mode() === next) return;
    setMode(next);
    setNotice(null);
    setFieldError(undefined);
    setStatus("");
    resetCode();
  }

  /**
   * One error map for all three verifiers. Order matters: the lockout answers
   * with 429, so it has to be recognised before the generic rate-limit check.
   */
  function handleError(error: unknown) {
    const code = authErrorCode(error);

    if (code === "INVALID_TWO_FACTOR_COOKIE") {
      setExpired(true);
      queueMicrotask(() => expiredHeadingRef?.focus());
      return;
    }
    if (code === "ACCOUNT_TEMPORARILY_LOCKED") {
      showNotice({ kind: "locked" });
      resetCode();
      return;
    }
    if (
      code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" ||
      code === "OTP_HAS_EXPIRED"
    ) {
      setCooldown(0);
      showNotice({
        kind: "error",
        message: "That code is no longer valid. Send yourself a new one.",
      });
      resetCode();
      return;
    }
    if (isRateLimitError(error)) {
      showNotice({ kind: "rate-limit" });
      return;
    }
    if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") {
      setFieldError(
        mode() === "backup"
          ? "That backup code doesn't match. Try another one."
          : "That code isn't right. Check your app and try again.",
      );
      resetCode();
      return;
    }
    showNotice({
      kind: "error",
      message: "We couldn't check that code. Try again shortly.",
    });
    resetCode();
  }

  async function verify(rawCode: string) {
    if (pending()) return;
    const code = rawCode.trim();
    if (!code) {
      setFieldError(`Enter your ${copy().label.toLowerCase()}.`);
      return;
    }
    if (mode() !== "backup" && code.length < CODE_LENGTH) {
      setFieldError(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }

    setNotice(null);
    setFieldError(undefined);
    setPending(true);
    try {
      const trust = trustDevice();
      const { error } =
        mode() === "backup"
          ? await authClient.twoFactor.verifyBackupCode({
              code,
              trustDevice: trust,
            })
          : mode() === "otp"
            ? await authClient.twoFactor.verifyOtp({ code, trustDevice: trust })
            : await authClient.twoFactor.verifyTotp({
                code,
                trustDevice: trust,
              });

      if (error) {
        handleError(error);
        return;
      }
      navigate(takeTwoFactorDestination(), { replace: true });
    } catch {
      showNotice({
        kind: "error",
        message:
          "We couldn't reach Flonion. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function sendEmailCode() {
    if (sending() || cooldown() > 0) return;
    setNotice(null);
    setFieldError(undefined);
    setSending(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp({});
      if (error) {
        const code = authErrorCode(error);
        if (code === "INVALID_TWO_FACTOR_COOKIE") {
          setExpired(true);
          queueMicrotask(() => expiredHeadingRef?.focus());
          return;
        }
        if (code === "OTP_NOT_ENABLED" || code === "OTP_NOT_CONFIGURED") {
          showNotice({
            kind: "error",
            message:
              "Email codes aren't available for this account. Use a backup code instead.",
          });
          return;
        }
        if (isRateLimitError(error)) {
          showNotice({ kind: "rate-limit" });
          return;
        }
        showNotice({
          kind: "error",
          message: "We couldn't send the code. Try again shortly.",
        });
        return;
      }
      setMode("otp");
      resetCode();
      startCooldown();
      setStatus("We sent a code to your email address.");
    } catch {
      showNotice({
        kind: "error",
        message:
          "We couldn't reach Flonion. Check your connection and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    void verify(mode() === "backup" ? backupCode() : pin().valueAsString);
  };

  return (
    <>
      <Title>Two-step verification · Flonion</Title>
      <Meta
        name="description"
        content="Enter your two-step verification code to finish logging in to Flonion."
      />
      {/* Nothing here should be indexed or previewed by a crawler. */}
      <Meta name="robots" content="noindex, nofollow" />

      <AuthShell
        skipTo="two-factor-form"
        skipLabel="Skip to verification form"
        aside={
          <A
            href="/login"
            class={cn("inline-flex min-h-11 items-center gap-1.5", textLink)}
          >
            <IconArrowLeft aria-hidden="true" class="size-4" />
            Back to log in
          </A>
        }
      >
        <Show
          when={!expired()}
          fallback={
            <div class="flex flex-col items-start">
              <span class="grid size-12 place-items-center rounded-full bg-accent-soft text-warning">
                <IconClockHour3 aria-hidden="true" class="size-6" />
              </span>
              <h1
                ref={expiredHeadingRef}
                tabindex="-1"
                class="mt-4 font-display text-xl font-semibold text-text outline-none"
              >
                This step has expired
              </h1>
              <p class="mt-2 text-base text-text-muted">
                A login attempt only stays open for a few minutes. Log in again
                and we'll ask for your code straight away.
              </p>
              <A href="/login" class={cn(submitClass, "mt-6")}>
                Back to log in
              </A>
            </div>
          }
        >
          <span class="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <IconShieldLock aria-hidden="true" class="size-6" />
          </span>
          <h1 class="mt-4 font-display text-xl font-semibold text-text">
            Two-step verification
          </h1>
          <p class="mt-1 text-base text-text-muted">{copy().lead}</p>

          <div
            ref={noticeRef}
            tabindex="-1"
            aria-live="assertive"
            class="outline-none"
          >
            <Show when={notice()}>
              {(n) => (
                <div
                  role="alert"
                  class="mt-5 flex items-start gap-2 rounded-md border border-error/40 bg-error/5 px-3 py-2.5 text-sm text-text"
                >
                  <Switch>
                    <Match when={n().kind === "error" && n()}>
                      {(err) => (
                        <>
                          <IconCircleX
                            aria-hidden="true"
                            class="mt-0.5 size-4 shrink-0 text-error"
                          />
                          <p>
                            <span class="sr-only">Error: </span>
                            {(err() as { message: string }).message}
                          </p>
                        </>
                      )}
                    </Match>
                    <Match when={n().kind === "locked"}>
                      <IconAlertTriangle
                        aria-hidden="true"
                        class="mt-0.5 size-4 shrink-0 text-error"
                      />
                      <p>
                        <span class="font-medium">
                          Too many wrong codes. Your account is locked for a
                          while.
                        </span>{" "}
                        Wait about 15 minutes, then try again. Your password
                        still works.
                      </p>
                    </Match>
                    <Match when={n().kind === "rate-limit"}>
                      <IconAlertTriangle
                        aria-hidden="true"
                        class="mt-0.5 size-4 shrink-0 text-error"
                      />
                      <p>
                        <span class="font-medium">Too many attempts.</span> Wait
                        a minute and try again.
                      </p>
                    </Match>
                  </Switch>
                </div>
              )}
            </Show>
          </div>

          {/* Polite: "code sent" must not interrupt the digits being typed. */}
          <p aria-live="polite" class="sr-only">
            {status()}
          </p>

          <form
            id="two-factor-form"
            method="post"
            novalidate
            onSubmit={onSubmit}
            class="mt-6 flex flex-col gap-5"
          >
            <Show
              when={mode() !== "backup"}
              fallback={
                <div class="flex flex-col gap-1.5">
                  <label for="backup-code" class={labelClass}>
                    {copy().label}
                  </label>
                  <input
                    ref={backupRef}
                    id="backup-code"
                    name="backup-code"
                    type="text"
                    inputmode="text"
                    autocomplete="one-time-code"
                    autocapitalize="none"
                    autocorrect="off"
                    spellcheck={false}
                    required
                    maxlength={BACKUP_CODE_MAX}
                    placeholder="abc12-DE34f"
                    value={backupCode()}
                    onInput={(event) => {
                      setBackupCode(event.currentTarget.value);
                      setFieldError(undefined);
                    }}
                    aria-invalid={Boolean(fieldError())}
                    aria-describedby={cn(
                      "two-factor-hint",
                      fieldError() && "two-factor-error",
                    )}
                    class={cn(inputBase, "font-mono tracking-wider")}
                  />
                  <p id="two-factor-hint" class="text-sm text-text-muted">
                    {copy().hint}
                  </p>
                  <FieldError id="two-factor-error" message={fieldError()} />
                </div>
              }
            >
              <PinInput.RootProvider
                value={pin}
                class="flex flex-col gap-1.5"
                aria-describedby={cn(
                  "two-factor-hint",
                  fieldError() && "two-factor-error",
                )}
              >
                <PinInput.Label class={labelClass}>
                  {copy().label}
                </PinInput.Label>
                <PinInput.Control class="flex justify-between gap-2">
                  <For each={pin().items}>
                    {(_, index) => (
                      <PinInput.Input
                        index={index()}
                        class={cn(
                          "size-12 min-w-0 flex-1 rounded-sm border border-border-strong bg-surface text-center font-mono text-lg text-text tabular-nums",
                          "transition-colors duration-[var(--duration-fast)] focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary",
                          "data-[invalid]:border-error disabled:opacity-70",
                        )}
                      />
                    )}
                  </For>
                </PinInput.Control>
                <PinInput.HiddenInput />
                <p id="two-factor-hint" class="text-sm text-text-muted">
                  {copy().hint}
                </p>
                <FieldError id="two-factor-error" message={fieldError()} />
              </PinInput.RootProvider>
            </Show>

            <div class="flex flex-col gap-1">
              <label class="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-text">
                <input
                  type="checkbox"
                  name="trust-device"
                  checked={trustDevice()}
                  onChange={(event) =>
                    setTrustDevice(event.currentTarget.checked)
                  }
                  class={cn(
                    "size-5 cursor-pointer rounded-sm border-border-strong accent-[var(--primary)]",
                    focusRing,
                  )}
                />
                Trust this device for 30 days
              </label>
              <p class="text-sm text-text-muted">
                Only tick this on a device that's yours — we'll skip the code
                here next time.
              </p>
            </div>

            <button
              type="submit"
              disabled={pending()}
              aria-disabled={pending()}
              class={submitClass}
            >
              <Show when={pending()} fallback={copy().submit}>
                <IconLoader2
                  aria-hidden="true"
                  class="size-5 motion-safe:animate-spin"
                />
                Verifying…
              </Show>
            </button>
          </form>

          <div class="mt-6 border-t border-border pt-5">
            <h2 class="text-sm font-medium text-text">
              {mode() === "totp"
                ? "Can't use your authenticator app?"
                : "Other ways to verify"}
            </h2>
            <ul class="mt-2 flex flex-col items-start gap-1">
              <Show when={mode() !== "totp"}>
                <li>
                  <AltAction onClick={() => switchTo("totp")}>
                    <IconShieldLock aria-hidden="true" class="size-4" />
                    Use my authenticator app
                  </AltAction>
                </li>
              </Show>

              <li>
                <AltAction
                  onClick={() => void sendEmailCode()}
                  disabled={sending() || cooldown() > 0}
                >
                  <Show
                    when={sending()}
                    fallback={<IconMail aria-hidden="true" class="size-4" />}
                  >
                    <IconLoader2
                      aria-hidden="true"
                      class="size-4 motion-safe:animate-spin"
                    />
                  </Show>
                  <Switch
                    fallback={
                      mode() === "otp"
                        ? "Send the code again"
                        : "Email me a code instead"
                    }
                  >
                    <Match when={sending()}>Sending…</Match>
                    <Match when={cooldown() > 0}>
                      Send again in{" "}
                      <span class="font-mono tabular-nums">{cooldown()}s</span>
                    </Match>
                  </Switch>
                </AltAction>
              </li>

              <Show when={mode() !== "backup"}>
                <li>
                  <AltAction onClick={() => switchTo("backup")}>
                    <IconCircleCheck aria-hidden="true" class="size-4" />
                    Use a backup code
                  </AltAction>
                </li>
              </Show>
            </ul>
          </div>
        </Show>
      </AuthShell>
    </>
  );
}

/** Link-weight action with a 44px hit area, per the touch-target rule. */
function AltAction(props: {
  onClick: () => void;
  disabled?: boolean;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      disabled={props.disabled}
      class={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline disabled:text-text-muted disabled:no-underline",
        focusRing,
      )}
    >
      {props.children}
    </button>
  );
}
