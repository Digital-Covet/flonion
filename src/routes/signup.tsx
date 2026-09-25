import { A, useSearchParams } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
  IconLoader2,
  IconMailCheck,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import {
  AuthShell,
  FieldError,
  inputBase,
  labelClass,
  PasswordInput,
  submitClass,
  textLink,
} from "~/components/auth/AuthShell";
import { PageMeta } from "~/components/meta/PageMeta";
import { authClient } from "~/lib/auth-client";
import {
  authErrorMessage,
  isRateLimitError,
  isRejectedEmailError,
  REJECTED_EMAIL_MESSAGE,
} from "~/lib/auth-errors";
import { cn } from "~/lib/cn";
import {
  inviteCallbackUrl,
  pickInviteToken,
  withInvite,
} from "~/lib/invite-redirect";

// better-auth defaults (emailAndPassword.min/maxPasswordLength are unset).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const RESEND_COOLDOWN = 60;

type Fields = "name" | "email" | "password";
type Notice = { kind: "error"; message: string } | { kind: "rate-limit" };

export default function SignupPage() {
  const [params] = useSearchParams();

  const invite = () => pickInviteToken(params.invite);
  // Verification signs the user in and lands them here: the invitation if
  // they have one, otherwise onboarding.
  const afterVerify = () => inviteCallbackUrl(invite(), "/onboarding");

  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<
    Partial<Record<Fields, string>>
  >({});
  const [sentTo, setSentTo] = createSignal<string | null>(null);

  const [cooldown, setCooldown] = createSignal(0);
  const [resending, setResending] = createSignal(false);
  const [resendStatus, setResendStatus] = createSignal<"sent" | "error" | null>(
    null,
  );
  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));

  const refs: Partial<Record<Fields, HTMLInputElement>> = {};
  let noticeRef: HTMLDivElement | undefined;
  let sentHeadingRef: HTMLHeadingElement | undefined;

  const longEnough = () => password().length >= MIN_PASSWORD;

  function startCooldown() {
    clearInterval(timer);
    setCooldown(RESEND_COOLDOWN);
    timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) clearInterval(timer);
        return Math.max(s - 1, 0);
      });
    }, 1000);
  }

  function clearFieldError(field: Fields) {
    if (fieldErrors()[field])
      setFieldErrors((f) => ({ ...f, [field]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<Fields, string>> = {};
    if (!name().trim()) errors.name = "Enter your name.";
    const value = email().trim();
    if (!value) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      errors.email = "Enter an email address like name@business.com.";
    if (!password()) errors.password = "Create a password.";
    else if (password().length < MIN_PASSWORD)
      errors.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (password().length > MAX_PASSWORD)
      errors.password = `Use ${MAX_PASSWORD} characters or fewer.`;
    setFieldErrors(errors);
    const first = (["name", "email", "password"] as const).find(
      (f) => errors[f],
    );
    if (first) refs[first]?.focus();
    return !first;
  }

  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    if (pending()) return;
    setNotice(null);
    if (!validate()) return;

    setPending(true);
    try {
      const { error } = await authClient.signUp.email({
        name: name().trim(),
        email: email().trim(),
        password: password(),
        callbackURL: afterVerify(),
      });

      if (error) {
        if (isRateLimitError(error)) {
          setNotice({ kind: "rate-limit" });
        } else if (error.code === "PASSWORD_TOO_SHORT") {
          setFieldErrors({
            password: `Use at least ${MIN_PASSWORD} characters.`,
          });
          refs.password?.focus();
          return;
        } else if (error.code === "INVALID_EMAIL") {
          setFieldErrors({
            email: "Enter an email address like name@business.com.",
          });
          refs.email?.focus();
          return;
        } else if (isRejectedEmailError(error)) {
          setFieldErrors({ email: REJECTED_EMAIL_MESSAGE });
          refs.email?.focus();
          return;
        } else {
          setNotice({
            kind: "error",
            message: authErrorMessage(
              error,
              "We couldn't create your account. Try again in a moment.",
            ),
          });
        }
        queueMicrotask(() => noticeRef?.focus());
        return;
      }

      // With email verification required, better-auth answers an existing
      // email with the same success response, so this screen never reveals
      // whether an account exists.
      setSentTo(email().trim());
      setPassword("");
      startCooldown();
      queueMicrotask(() => sentHeadingRef?.focus());
    } catch {
      setNotice({
        kind: "error",
        message:
          "We couldn't reach Flonion. Check your connection and try again.",
      });
      queueMicrotask(() => noticeRef?.focus());
    } finally {
      setPending(false);
    }
  };

  async function resend() {
    const to = sentTo();
    if (!to || cooldown() > 0 || resending()) return;
    setResending(true);
    setResendStatus(null);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: to,
        callbackURL: afterVerify(),
      });
      setResendStatus(error ? "error" : "sent");
      startCooldown();
    } catch {
      setResendStatus("error");
    } finally {
      setResending(false);
    }
  }

  function useDifferentEmail() {
    setSentTo(null);
    setResendStatus(null);
    clearInterval(timer);
    setCooldown(0);
    queueMicrotask(() => refs.email?.focus());
  }

  return (
    <>
      <PageMeta
        title="Create your account · Flonion"
        description="Create a free Flonion account to collect genuine reviews, draft replies with AI, and get found locally."
        path="/signup"
        noindex
      />

      <AuthShell
        skipTo={sentTo() ? "signup-sent" : "signup-form"}
        skipLabel="Skip to sign-up form"
        aside={
          <>
            Already have an account?{" "}
            <A href={withInvite("/login", invite())} class={textLink}>
              Log in
            </A>
          </>
        }
      >
        <Show
          when={sentTo()}
          fallback={
            <>
              <h1 class="font-display text-xl font-semibold text-text">
                Create your Flonion account
              </h1>
              <p class="mt-1 text-base text-text-muted">
                Free to start. Set up your first review link in minutes.
              </p>

              <Show when={invite()}>
                <p class="mt-5 flex items-start gap-2 rounded-md bg-primary-soft px-3 py-2.5 text-sm text-primary">
                  <IconInfoCircle
                    aria-hidden="true"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  Create an account to join your team. Use the email address
                  your invitation was sent to.
                </p>
              </Show>

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
                        <Match when={n().kind === "rate-limit"}>
                          <IconAlertTriangle
                            aria-hidden="true"
                            class="mt-0.5 size-4 shrink-0 text-error"
                          />
                          <p>
                            <span class="font-medium">Too many attempts.</span>{" "}
                            Wait a minute and try again.
                          </p>
                        </Match>
                      </Switch>
                    </div>
                  )}
                </Show>
              </div>

              <form
                id="signup-form"
                method="post"
                novalidate
                onSubmit={onSubmit}
                class="mt-6 flex flex-col gap-5"
              >
                <div class="flex flex-col gap-1.5">
                  <label for="signup-name" class={labelClass}>
                    Your name
                  </label>
                  <input
                    ref={(el) => {
                      refs.name = el;
                    }}
                    id="signup-name"
                    name="name"
                    type="text"
                    autocomplete="name"
                    required
                    maxlength={100}
                    placeholder="Asha Mehta"
                    value={name()}
                    onInput={(e) => {
                      setName(e.currentTarget.value);
                      clearFieldError("name");
                    }}
                    aria-invalid={Boolean(fieldErrors().name)}
                    aria-describedby={
                      fieldErrors().name ? "signup-name-error" : undefined
                    }
                    class={inputBase}
                  />
                  <FieldError
                    id="signup-name-error"
                    message={fieldErrors().name}
                  />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="signup-email" class={labelClass}>
                    Work email
                  </label>
                  <input
                    ref={(el) => {
                      refs.email = el;
                    }}
                    id="signup-email"
                    name="email"
                    type="email"
                    inputmode="email"
                    autocomplete="email"
                    autocapitalize="none"
                    spellcheck={false}
                    required
                    placeholder="name@business.com"
                    value={email()}
                    onInput={(e) => {
                      setEmail(e.currentTarget.value);
                      clearFieldError("email");
                    }}
                    aria-invalid={Boolean(fieldErrors().email)}
                    aria-describedby={
                      fieldErrors().email ? "signup-email-error" : undefined
                    }
                    class={inputBase}
                  />
                  <FieldError
                    id="signup-email-error"
                    message={fieldErrors().email}
                  />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="signup-password" class={labelClass}>
                    Password
                  </label>
                  <PasswordInput
                    ref={(el) => {
                      refs.password = el;
                    }}
                    id="signup-password"
                    name="password"
                    autocomplete="new-password"
                    required
                    minlength={MIN_PASSWORD}
                    maxlength={MAX_PASSWORD}
                    value={password()}
                    onInput={(e) => {
                      setPassword(e.currentTarget.value);
                      clearFieldError("password");
                    }}
                    aria-invalid={Boolean(fieldErrors().password)}
                    aria-describedby={cn(
                      "signup-password-hint",
                      fieldErrors().password && "signup-password-error",
                    )}
                  />
                  <p
                    id="signup-password-hint"
                    class={cn(
                      "flex items-center gap-1.5 text-sm",
                      longEnough() ? "text-success" : "text-text-muted",
                    )}
                  >
                    <Show
                      when={longEnough()}
                      fallback={
                        <span
                          aria-hidden="true"
                          class="grid size-4 shrink-0 place-items-center"
                        >
                          <span class="size-1.5 rounded-full bg-current" />
                        </span>
                      }
                    >
                      <IconCircleCheck
                        aria-hidden="true"
                        class="size-4 shrink-0"
                      />
                    </Show>
                    At least {MIN_PASSWORD} characters
                  </p>
                  <FieldError
                    id="signup-password-error"
                    message={fieldErrors().password}
                  />
                </div>

                <button
                  type="submit"
                  disabled={pending()}
                  aria-disabled={pending()}
                  class={submitClass}
                >
                  <Show when={pending()} fallback="Create account">
                    <IconLoader2
                      aria-hidden="true"
                      class="size-5 motion-safe:animate-spin"
                    />
                    Creating account…
                  </Show>
                </button>

                <p class="text-center text-xs text-text-muted">
                  We'll email you a link to confirm your address before you can
                  log in.
                </p>
              </form>
            </>
          }
        >
          {(to) => (
            <div id="signup-sent" class="flex flex-col items-start">
              <span class="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
                <IconMailCheck aria-hidden="true" class="size-6" />
              </span>
              <h1
                ref={sentHeadingRef}
                tabindex="-1"
                class="mt-4 font-display text-xl font-semibold text-text outline-none"
              >
                Check your email
              </h1>
              <p class="mt-2 text-base text-text-muted">
                We sent a confirmation link to{" "}
                <span class="font-medium break-all text-text">{to()}</span>.
                Open it on this device to finish setting up your account.
              </p>
              <p class="mt-3 text-sm text-text-muted">
                The link can take a minute to arrive. Check your spam or
                promotions folder too.
              </p>

              <div class="mt-6 flex w-full flex-col gap-3">
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown() > 0 || resending()}
                  class={cn(
                    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-border-strong px-5 font-display text-base font-semibold text-text transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent",
                  )}
                >
                  <Switch fallback="Resend link">
                    <Match when={resending()}>
                      <IconLoader2
                        aria-hidden="true"
                        class="size-5 motion-safe:animate-spin"
                      />
                      Sending…
                    </Match>
                    <Match when={cooldown() > 0}>
                      Resend link in{" "}
                      <span class="font-mono tabular-nums">{cooldown()}s</span>
                    </Match>
                  </Switch>
                </button>
                <button
                  type="button"
                  onClick={useDifferentEmail}
                  class={cn("mx-auto min-h-11 px-2 text-sm", textLink)}
                >
                  Use a different email
                </button>
              </div>

              <p aria-live="polite" class="mt-2 min-h-6 text-sm">
                <Switch>
                  <Match when={resendStatus() === "sent"}>
                    <span class="flex items-center gap-1.5 text-success">
                      <IconCircleCheck
                        aria-hidden="true"
                        class="size-4 shrink-0"
                      />
                      New link sent.
                    </span>
                  </Match>
                  <Match when={resendStatus() === "error"}>
                    <span class="flex items-center gap-1.5 text-error">
                      <IconCircleX aria-hidden="true" class="size-4 shrink-0" />
                      We couldn't send a new link. Try again shortly.
                    </span>
                  </Match>
                </Switch>
              </p>
            </div>
          )}
        </Show>
      </AuthShell>
    </>
  );
}
