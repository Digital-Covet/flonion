import { Meta, Title } from "@solidjs/meta";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconCircleX,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-solidjs";
import { createSignal, type JSX, Match, Show, Switch } from "solid-js";
import {
  AuthShell,
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  PasswordInput,
  submitClass,
  textLink,
} from "~/components/auth/AuthShell";
import { authClient } from "~/lib/auth-client";
import {
  authErrorCode,
  authErrorMessage,
  EMAIL_NOT_VERIFIED,
  isRateLimitError,
} from "~/lib/auth-errors";
import { cn } from "~/lib/cn";
import {
  inviteCallbackUrl,
  pickInviteToken,
  withInvite,
} from "~/lib/invite-redirect";
import {
  safeRedirectPath,
  stashTwoFactorDestination,
} from "~/lib/post-login-redirect";

type Notice =
  | { kind: "error"; message: string }
  | { kind: "rate-limit" }
  | { kind: "unverified"; email: string };

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const invite = () => pickInviteToken(params.invite);
  const destination = () =>
    inviteCallbackUrl(invite(), safeRedirectPath(params.callbackURL));

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [remember, setRemember] = createSignal(true);
  const [pending, setPending] = createSignal(false);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<{
    email?: string;
    password?: string;
  }>({});

  let emailRef: HTMLInputElement | undefined;
  let passwordRef: HTMLInputElement | undefined;
  let noticeRef: HTMLDivElement | undefined;

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    const value = email().trim();
    if (!value) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      errors.email = "Enter an email address like name@business.com.";
    if (!password()) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (errors.email) emailRef?.focus();
    else if (errors.password) passwordRef?.focus();
    return !errors.email && !errors.password;
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
      // A 2FA-enabled account never reaches the `navigate` below: the client
      // plugin redirects to /2fa with a full page load and an empty query
      // string, so park the destination before asking for it.
      stashTwoFactorDestination(destination());

      const { data, error } = await authClient.signIn.email({
        email: email().trim(),
        password: password(),
        rememberMe: remember(),
        callbackURL: destination(),
      });

      if (error) {
        if (isRateLimitError(error)) {
          setNotice({ kind: "rate-limit" });
        } else if (authErrorCode(error) === EMAIL_NOT_VERIFIED) {
          setNotice({ kind: "unverified", email: email().trim() });
        } else if (error.status === 401 || error.status === 400) {
          // Never reveal whether the account exists.
          setNotice({
            kind: "error",
            message:
              "That email and password don't match. Check both and try again.",
          });
        } else {
          setNotice({
            kind: "error",
            message: authErrorMessage(
              error,
              "We couldn't log you in. Check your connection and try again.",
            ),
          });
        }
        queueMicrotask(() => noticeRef?.focus());
        return;
      }

      // The two-factor client plugin redirects to /2fa on its own.
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;

      navigate(destination(), { replace: true });
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

  return (
    <>
      <Title>Log in · Flonion</Title>
      <Meta
        name="description"
        content="Log in to Flonion to collect reviews, draft replies, and grow your local business."
      />

      <AuthShell
        skipTo="login-form"
        skipLabel="Skip to login form"
        aside={
          <>
            New to Flonion?{" "}
            <A href={withInvite("/signup", invite())} class={textLink}>
              Create a free account
            </A>
          </>
        }
      >
        <h1 class="font-display text-xl font-semibold text-text">
          Log in to Flonion
        </h1>
        <p class="mt-1 text-base text-text-muted">
          Welcome back. Your reviews are waiting.
        </p>

        <Show when={invite()}>
          <p class="mt-5 flex items-start gap-2 rounded-md bg-primary-soft px-3 py-2.5 text-sm text-primary">
            <IconInfoCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
            Log in to accept your team invitation.
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
                class={cn(
                  "mt-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-text",
                  n().kind === "unverified"
                    ? "border-warning/40 bg-accent-soft"
                    : "border-error/40 bg-error/5",
                )}
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
                      <span class="font-medium">Too many attempts.</span> Wait a
                      minute and try again. You can also{" "}
                      <A href="/forgot-password" class={textLink}>
                        reset your password
                      </A>
                      .
                    </p>
                  </Match>
                  <Match when={n().kind === "unverified" && n()}>
                    {(u) => (
                      <>
                        <IconAlertTriangle
                          aria-hidden="true"
                          class="mt-0.5 size-4 shrink-0 text-warning"
                        />
                        <p>
                          <span class="font-medium">
                            Verify your email first.
                          </span>{" "}
                          We sent a link when you signed up.{" "}
                          <A
                            href={`/verify-email?email=${encodeURIComponent(
                              (u() as { email: string }).email,
                            )}`}
                            class={textLink}
                          >
                            Send a new link
                          </A>
                        </p>
                      </>
                    )}
                  </Match>
                </Switch>
              </div>
            )}
          </Show>
        </div>

        <form
          id="login-form"
          method="post"
          novalidate
          onSubmit={onSubmit}
          class="mt-6 flex flex-col gap-5"
        >
          <div class="flex flex-col gap-1.5">
            <label for="login-email" class={labelClass}>
              Email
            </label>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              inputmode="email"
              autocomplete="username"
              autocapitalize="none"
              spellcheck={false}
              required
              placeholder="name@business.com"
              value={email()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                if (fieldErrors().email)
                  setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors().email)}
              aria-describedby={
                fieldErrors().email ? "login-email-error" : undefined
              }
              class={inputBase}
            />
            <FieldError id="login-email-error" message={fieldErrors().email} />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-3">
              <label for="login-password" class={labelClass}>
                Password
              </label>
              <A href="/forgot-password" class={cn("text-sm", textLink)}>
                Forgot password?
              </A>
            </div>
            <PasswordInput
              ref={passwordRef}
              id="login-password"
              name="password"
              autocomplete="current-password"
              required
              value={password()}
              onInput={(e) => {
                setPassword(e.currentTarget.value);
                if (fieldErrors().password)
                  setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors().password)}
              aria-describedby={
                fieldErrors().password ? "login-password-error" : undefined
              }
            />
            <FieldError
              id="login-password-error"
              message={fieldErrors().password}
            />
          </div>

          <label class="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              name="remember"
              checked={remember()}
              onChange={(e) => setRemember(e.currentTarget.checked)}
              class={cn(
                "size-5 cursor-pointer rounded-sm border-border-strong accent-[var(--primary)]",
                focusRing,
              )}
            />
            Keep me logged in on this device
          </label>

          <button
            type="submit"
            disabled={pending()}
            aria-disabled={pending()}
            class={submitClass}
          >
            <Show when={pending()} fallback="Log in">
              <IconLoader2
                aria-hidden="true"
                class="size-5 motion-safe:animate-spin"
              />
              Logging in…
            </Show>
          </button>
        </form>
      </AuthShell>
    </>
  );
}
