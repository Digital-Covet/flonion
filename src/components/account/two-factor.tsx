import { PinInput, usePinInput } from "@ark-ui/solid/pin-input";
import {
  IconCircleCheck,
  IconDeviceMobile,
  IconDownload,
  IconKey,
  IconShieldCheck,
  IconShieldOff,
} from "@tabler/icons-solidjs";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";
import { AccountPanel, StatusChip } from "~/components/account/ui";
import {
  FieldError,
  focusRing,
  labelClass,
  PasswordInput,
} from "~/components/auth/AuthShell";
import { QrSvg } from "~/components/landing/brand";
import {
  btnPrimary,
  btnSecondary,
  CopyButton,
  NETWORK_ERROR,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import { authClient } from "~/lib/auth-client";
import {
  authErrorCode,
  isRateLimitError,
  RATE_LIMIT_MESSAGE,
} from "~/lib/auth-errors";
import { cn } from "~/lib/cn";

const CODE_LENGTH = 6;
const CODES_FILENAME = "flonion-backup-codes.txt";

const panelAction = "min-h-11 w-full px-4 text-sm sm:w-auto";

/**
 * Where the flow is. Turning 2FA on is three steps that must not be
 * interruptible by a stray click elsewhere in the page, so each one replaces
 * the panel's body rather than opening a dialog — a wizard in a modal is worse
 * on a phone, which is where the authenticator app lives.
 */
type Stage =
  | { kind: "idle" }
  /** Password gate. `next` says what it unlocks. */
  | { kind: "password"; next: "enable" | "codes" | "disable" }
  | { kind: "verify"; totpURI: string; backupCodes: string[] }
  /** `fresh` means 2FA was just turned on, so the codes are the last step. */
  | { kind: "codes"; codes: string[]; fresh: boolean };

/** `otpauth://totp/Flonion:me@x?secret=ABC…` — the manual-entry key. */
function secretOf(totpURI: string): string {
  return /[?&]secret=([^&]+)/i.exec(totpURI)?.[1] ?? "";
}

const CODES_HEADER = [
  "Flonion backup codes",
  "Each code works once. Keep them somewhere only you can reach.",
  "",
].join("\n");

function downloadCodes(codes: string[]) {
  const blob = new Blob([`${CODES_HEADER}${codes.join("\n")}\n`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = CODES_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Two-step verification (spec §6, Account: "2FA setup with QR and backup codes
 * (download + 'I saved them' checkbox)").
 *
 * better-auth does not mark the account as protected when `enable` is called —
 * only once a TOTP code from the authenticator app verifies. That is deliberate
 * and the panel follows it: an owner who scans nothing and closes the tab is
 * left exactly as they were, not locked out of their own account.
 */
export function TwoFactorPanel(props: {
  enabled: boolean;
  /** Re-reads the session so the status here matches the server. */
  onChanged: () => void | Promise<void>;
  focusHeading?: boolean;
}) {
  const [stage, setStage] = createSignal<Stage>({ kind: "idle" });
  const [password, setPassword] = createSignal("");
  const [passwordError, setPasswordError] = createSignal<string>();
  const [codeError, setCodeError] = createSignal<string>();
  const [banner, setBanner] = createSignal<{
    tone: "error" | "success" | "warning";
    text: JSX.Element;
  }>();
  const [pending, setPending] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  let passwordRef: HTMLInputElement | undefined;
  let stepHeadingRef: HTMLHeadingElement | undefined;

  /** Narrows the stage for a `<Match>`; returns undefined when it isn't that one. */
  function at<K extends Stage["kind"]>(kind: K) {
    const current = stage();
    return current.kind === kind
      ? (current as Extract<Stage, { kind: K }>)
      : undefined;
  }

  const pin = usePinInput(() => ({
    id: "account-totp-code",
    count: CODE_LENGTH,
    otp: true,
    type: "numeric" as const,
    placeholder: "",
    invalid: Boolean(codeError()),
    disabled: pending(),
    blurOnComplete: false,
    translations: {
      inputLabel: (index: number, length: number) =>
        `Digit ${index + 1} of ${length}`,
    },
    onValueComplete: (details: { valueAsString: string }) => {
      void verify(details.valueAsString);
    },
    onValueChange: (details: { valueAsString: string }) => {
      if (details.valueAsString.length > 0) setCodeError(undefined);
    },
  }));

  function focusStep() {
    queueMicrotask(() => stepHeadingRef?.focus());
  }

  function toIdle(note?: { tone: "success" | "warning"; text: JSX.Element }) {
    setStage({ kind: "idle" });
    setPassword("");
    setPasswordError(undefined);
    setCodeError(undefined);
    setSaved(false);
    pin().clearValue();
    setBanner(note);
  }

  function askPassword(next: "enable" | "codes" | "disable") {
    setBanner(undefined);
    setPassword("");
    setPasswordError(undefined);
    setStage({ kind: "password", next });
    focusStep();
    queueMicrotask(() => passwordRef?.focus());
  }

  /** One mapping for every password-gated call on this panel. */
  function handleError(error: unknown, fallback: string): void {
    const code = authErrorCode(error);
    if (code === "INVALID_PASSWORD") {
      setPasswordError("That isn't your password.");
      passwordRef?.focus();
      return;
    }
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
      setBanner({
        tone: "error",
        text: "This account doesn't have a password yet, so we can't confirm it's you.",
      });
      return;
    }
    if (code === "TOTP_ALREADY_ENABLED") {
      setBanner({
        tone: "warning",
        text: "Two-step verification is already on for this account.",
      });
      void props.onChanged();
      return;
    }
    if (isRateLimitError(error)) {
      setBanner({ tone: "error", text: RATE_LIMIT_MESSAGE });
      return;
    }
    setBanner({ tone: "error", text: fallback });
  }

  async function submitPassword(event: SubmitEvent) {
    event.preventDefault();
    const current = stage();
    if (pending() || current.kind !== "password") return;
    if (!password()) {
      setPasswordError("Enter your password.");
      passwordRef?.focus();
      return;
    }

    setPasswordError(undefined);
    setBanner(undefined);
    setPending(true);
    try {
      if (current.next === "enable") {
        const { data, error } = await authClient.twoFactor.enable({
          password: password(),
          method: "totp",
        });
        if (error || data?.method !== "totp") {
          handleError(error, "We couldn't start the setup. Try again shortly.");
          return;
        }
        setPassword("");
        setStage({
          kind: "verify",
          totpURI: data.totpURI,
          backupCodes: data.backupCodes,
        });
        focusStep();
        queueMicrotask(() => pin().focus());
        return;
      }

      if (current.next === "codes") {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({
          password: password(),
        });
        if (error || !data?.backupCodes) {
          handleError(
            error,
            "We couldn't make new backup codes. Try again shortly.",
          );
          return;
        }
        setPassword("");
        setSaved(false);
        setStage({ kind: "codes", codes: data.backupCodes, fresh: false });
        focusStep();
        return;
      }

      const { error } = await authClient.twoFactor.disable({
        password: password(),
      });
      if (error) {
        handleError(error, "We couldn't turn it off. Try again shortly.");
        return;
      }
      await props.onChanged();
      toIdle({
        tone: "warning",
        text: "Two-step verification is off. Your password is now the only thing protecting this account.",
      });
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  /** Setup's last gate: better-auth only flips the account on once this passes. */
  async function verify(raw: string) {
    const current = stage();
    if (pending() || current.kind !== "verify") return;
    const code = raw.trim();
    if (code.length < CODE_LENGTH) {
      setCodeError(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }

    setCodeError(undefined);
    setBanner(undefined);
    setPending(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        const errorCode = authErrorCode(error);
        if (errorCode === "INVALID_CODE") {
          setCodeError("That code isn't right. Check your app and try again.");
          pin().clearValue();
          queueMicrotask(() => pin().focus());
          return;
        }
        if (isRateLimitError(error)) {
          setBanner({ tone: "error", text: RATE_LIMIT_MESSAGE });
          pin().clearValue();
          return;
        }
        setBanner({
          tone: "error",
          text: "We couldn't check that code. Try again shortly.",
        });
        pin().clearValue();
        return;
      }

      await props.onChanged();
      pin().clearValue();
      setSaved(false);
      setStage({ kind: "codes", codes: current.backupCodes, fresh: true });
      focusStep();
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountPanel
      id="two-factor"
      title="Two-step verification"
      lead="Ask for a code from your phone as well as your password, so a stolen password isn't enough on its own."
      focusHeading={props.focusHeading}
    >
      <div class="flex flex-col gap-5">
        <Show when={banner()}>
          {(note) => <Notice tone={note().tone}>{note().text}</Notice>}
        </Show>

        <Switch>
          {/* ── status ── */}
          <Match when={at("idle")}>
            <div class="flex flex-col gap-5">
              <div class="flex flex-wrap items-center gap-3">
                <Show
                  when={props.enabled}
                  fallback={
                    <StatusChip tone="muted" icon={IconShieldOff}>
                      Off
                    </StatusChip>
                  }
                >
                  <StatusChip tone="success" icon={IconShieldCheck}>
                    On
                  </StatusChip>
                </Show>
                <p class="text-sm text-text-muted">
                  <Show
                    when={props.enabled}
                    fallback="Your password is the only thing protecting this account."
                  >
                    We'll ask for a code whenever you log in on a new device.
                  </Show>
                </p>
              </div>

              <Show
                when={props.enabled}
                fallback={
                  <div class="flex flex-col items-start gap-4">
                    <ol class="flex flex-col gap-2 text-sm text-text-muted">
                      <SetupBullet icon={IconDeviceMobile}>
                        You'll need an authenticator app — Google Authenticator,
                        Authy, or the one in your password manager.
                      </SetupBullet>
                      <SetupBullet icon={IconKey}>
                        We'll give you backup codes for the day your phone isn't
                        with you.
                      </SetupBullet>
                    </ol>
                    <button
                      type="button"
                      onClick={() => askPassword("enable")}
                      class={cn(btnPrimary, panelAction)}
                    >
                      <IconShieldCheck aria-hidden="true" class="size-4" />
                      Turn on two-step verification
                    </button>
                  </div>
                }
              >
                <div class="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => askPassword("codes")}
                    class={cn(btnSecondary, panelAction)}
                  >
                    <IconKey aria-hidden="true" class="size-4" />
                    Replace backup codes
                  </button>
                  <button
                    type="button"
                    onClick={() => askPassword("disable")}
                    class={cn(
                      btnSecondary,
                      panelAction,
                      "border-error/40 text-error hover:bg-error/5",
                    )}
                  >
                    <IconShieldOff aria-hidden="true" class="size-4" />
                    Turn off
                  </button>
                </div>
              </Show>
            </div>
          </Match>

          {/* ── password gate ── */}
          <Match when={at("password")}>
            {(current) => {
              const next = () => current().next;
              return (
                <form
                  novalidate
                  onSubmit={submitPassword}
                  class="flex max-w-md flex-col items-start gap-4"
                >
                  <StepHeading
                    ref={(el) => {
                      stepHeadingRef = el;
                    }}
                  >
                    Confirm it's you
                  </StepHeading>
                  <Show when={next() === "disable"}>
                    <Notice tone="warning" class="w-full">
                      Turning this off means anyone with your password can get
                      in. Your backup codes stop working too.
                    </Notice>
                  </Show>
                  <Show when={next() === "codes"}>
                    <Notice tone="info" class="w-full">
                      New codes replace the old ones straight away. Any code you
                      wrote down before will stop working.
                    </Notice>
                  </Show>

                  <div class="flex w-full flex-col gap-1.5">
                    <label for="account-2fa-password" class={labelClass}>
                      Your password
                    </label>
                    <PasswordInput
                      ref={(el) => {
                        passwordRef = el;
                      }}
                      id="account-2fa-password"
                      name="password"
                      autocomplete="current-password"
                      required
                      value={password()}
                      onInput={(event) => {
                        setPassword(event.currentTarget.value);
                        setPasswordError(undefined);
                      }}
                      aria-invalid={Boolean(passwordError())}
                      aria-describedby={
                        passwordError()
                          ? "account-2fa-password-error"
                          : undefined
                      }
                    />
                    <FieldError
                      id="account-2fa-password-error"
                      message={passwordError()}
                    />
                  </div>

                  <div class="flex w-full flex-col-reverse gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={pending()}
                      onClick={() => toIdle()}
                      class={cn(btnSecondary, panelAction)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pending()}
                      aria-disabled={pending()}
                      class={cn(
                        btnPrimary,
                        panelAction,
                        next() === "disable" && "bg-error text-surface",
                        "disabled:cursor-progress disabled:opacity-80",
                      )}
                    >
                      <Show when={pending()}>
                        <Spinner class="size-4" />
                      </Show>
                      <Switch fallback="Continue">
                        <Match when={pending()}>Checking…</Match>
                        <Match when={next() === "disable"}>
                          Turn off two-step verification
                        </Match>
                        <Match when={next() === "codes"}>
                          Make new backup codes
                        </Match>
                      </Switch>
                    </button>
                  </div>
                </form>
              );
            }}
          </Match>

          {/* ── scan + verify ── */}
          <Match when={at("verify")}>
            {(current) => {
              const uri = () => current().totpURI;
              return (
                <div class="flex flex-col gap-6">
                  <div class="flex flex-col gap-3">
                    <StepHeading
                      ref={(el) => {
                        stepHeadingRef = el;
                      }}
                    >
                      Step 1 — scan this with your authenticator app
                    </StepHeading>
                    <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                      <div class="rounded-md border border-border bg-white p-3">
                        <QrSvg value={uri()} class="size-40" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-text-muted">
                          Can't scan it? Add the account by hand with this key:
                        </p>
                        <p class="mt-1.5 font-mono text-sm break-all text-text">
                          {secretOf(uri())}
                        </p>
                        <div class="-ml-3 mt-1">
                          <CopyButton
                            value={secretOf(uri())}
                            label="Copy key"
                            announce="Setup key copied"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col gap-3 border-t border-border pt-5">
                    <h3 class="font-display text-base font-semibold text-text">
                      Step 2 — enter the 6-digit code it shows
                    </h3>
                    <PinInput.RootProvider
                      value={pin}
                      class="flex max-w-xs flex-col gap-1.5"
                      aria-describedby={cn(
                        "account-totp-hint",
                        codeError() && "account-totp-error",
                      )}
                    >
                      <PinInput.Label class={labelClass}>
                        Code from your app
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
                      <p id="account-totp-hint" class="text-sm text-text-muted">
                        The code changes every 30 seconds.
                      </p>
                      <FieldError
                        id="account-totp-error"
                        message={codeError()}
                      />
                    </PinInput.RootProvider>

                    <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row">
                      <button
                        type="button"
                        disabled={pending()}
                        onClick={() => toIdle()}
                        class={cn(btnSecondary, panelAction)}
                      >
                        Cancel setup
                      </button>
                      <button
                        type="button"
                        disabled={pending()}
                        aria-disabled={pending()}
                        onClick={() => void verify(pin().valueAsString)}
                        class={cn(
                          btnPrimary,
                          panelAction,
                          "disabled:cursor-progress disabled:opacity-80",
                        )}
                      >
                        <Show when={pending()} fallback="Turn it on">
                          <Spinner class="size-4" />
                          Checking…
                        </Show>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Match>

          {/* ── backup codes ── */}
          <Match when={at("codes")}>
            {(detail) => {
              return (
                <div class="flex flex-col gap-4">
                  <StepHeading
                    ref={(el) => {
                      stepHeadingRef = el;
                    }}
                  >
                    <Show
                      when={detail().fresh}
                      fallback="Your new backup codes"
                    >
                      Two-step verification is on — save your backup codes
                    </Show>
                  </StepHeading>

                  <Notice tone="warning">
                    This is the only time we'll show these. Each code gets you
                    in once, on a day your phone doesn't.
                  </Notice>

                  <ul class="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-background p-4 font-mono text-sm tabular-nums text-text sm:grid-cols-3">
                    <For each={detail().codes}>
                      {(code) => <li class="break-all">{code}</li>}
                    </For>
                  </ul>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadCodes(detail().codes)}
                      class={cn(btnSecondary, "min-h-11 px-4 text-sm")}
                    >
                      <IconDownload aria-hidden="true" class="size-4" />
                      Download as .txt
                    </button>
                    <CopyButton
                      value={detail().codes.join("\n")}
                      label="Copy codes"
                      announce="Backup codes copied"
                    />
                  </div>

                  <label class="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={saved()}
                      onChange={(event) =>
                        setSaved(event.currentTarget.checked)
                      }
                      class={cn(
                        "size-5 cursor-pointer rounded-sm border-border-strong accent-[var(--primary)]",
                        focusRing,
                      )}
                    />
                    I've saved my backup codes somewhere safe
                  </label>

                  <button
                    type="button"
                    disabled={!saved()}
                    onClick={() =>
                      toIdle({
                        tone: "success",
                        text: detail().fresh
                          ? "Two-step verification is on. We'll ask for a code next time you log in on a new device."
                          : "Your backup codes have been replaced. The old ones no longer work.",
                      })
                    }
                    class={cn(
                      btnPrimary,
                      panelAction,
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    <IconCircleCheck aria-hidden="true" class="size-4" />
                    Done
                  </button>
                </div>
              );
            }}
          </Match>
        </Switch>
      </div>
    </AccountPanel>
  );
}

/** Sub-step heading that takes focus when its step arrives. */
function StepHeading(props: {
  ref: (el: HTMLHeadingElement) => void;
  children: JSX.Element;
}) {
  return (
    <h3
      ref={props.ref}
      tabindex="-1"
      class="font-display text-base font-semibold text-text outline-none"
    >
      {props.children}
    </h3>
  );
}

/** Icon + line of setup prose; the icon is decoration, the words carry it. */
function SetupBullet(props: { icon: typeof IconKey; children: JSX.Element }) {
  return (
    <li class="flex items-start gap-2">
      <props.icon
        aria-hidden="true"
        class="mt-0.5 size-4 shrink-0 text-primary"
      />
      <span class="min-w-0 flex-1">{props.children}</span>
    </li>
  );
}
