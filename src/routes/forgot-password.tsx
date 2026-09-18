import { A, useSearchParams } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
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
  submitClass,
  textLink,
} from "~/components/auth/AuthShell";
import { PageMeta } from "~/components/meta/PageMeta";
import { authClient } from "~/lib/auth-client";
import { isRateLimitError } from "~/lib/auth-errors";
import { cn } from "~/lib/cn";

const RESEND_COOLDOWN = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Notice = { kind: "error"; message: string } | { kind: "rate-limit" };

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();

  const initialEmail = () => {
    const raw = Array.isArray(params.email) ? params.email[0] : params.email;
    return raw && EMAIL_PATTERN.test(raw) ? raw : "";
  };
  // /reset-password sends people back here when their link is used or expired.
  const linkExpired = () => params.error === "INVALID_TOKEN";

  const [email, setEmail] = createSignal(initialEmail());
  const [pending, setPending] = createSignal(false);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [emailError, setEmailError] = createSignal<string>();
  const [sentTo, setSentTo] = createSignal<string | null>(null);

  const [cooldown, setCooldown] = createSignal(0);
  const [resendStatus, setResendStatus] = createSignal<
    "sent" | "error" | "rate-limit" | null
  >(null);
  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));

  let emailRef: HTMLInputElement | undefined;
  let noticeRef: HTMLDivElement | undefined;
  let sentHeadingRef: HTMLHeadingElement | undefined;

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

  /**
   * better-auth answers with the same success whether or not the account
   * exists, so only rate limits and transport failures surface here.
   */
  async function requestLink(to: string): Promise<"sent" | "rate-limit"> {
    const { error } = await authClient.requestPasswordReset({
      email: to,
      redirectTo: "/reset-password",
    });
    if (error && isRateLimitError(error)) return "rate-limit";
    if (error && (error.status ?? 0) >= 500) throw error;
    return "sent";
  }

  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    if (pending()) return;
    setNotice(null);

    const value = email().trim();
    const error = !value
      ? "Enter your email address."
      : EMAIL_PATTERN.test(value)
        ? undefined
        : "Enter an email address like name@business.com.";
    setEmailError(error);
    if (error) {
      emailRef?.focus();
      return;
    }

    setPending(true);
    try {
      if ((await requestLink(value)) === "rate-limit") {
        setNotice({ kind: "rate-limit" });
        queueMicrotask(() => noticeRef?.focus());
        return;
      }
      setSentTo(value);
      startCooldown();
      queueMicrotask(() => sentHeadingRef?.focus());
    } catch {
      setNotice({
        kind: "error",
        message:
          "We couldn't send the link. Check your connection and try again.",
      });
      queueMicrotask(() => noticeRef?.focus());
    } finally {
      setPending(false);
    }
  };

  async function resend() {
    const to = sentTo();
    if (!to || cooldown() > 0 || pending()) return;
    setPending(true);
    setResendStatus(null);
    try {
      setResendStatus(await requestLink(to));
    } catch {
      setResendStatus("error");
    } finally {
      startCooldown();
      setPending(false);
    }
  }

  function useDifferentEmail() {
    setSentTo(null);
    setResendStatus(null);
    clearInterval(timer);
    setCooldown(0);
    queueMicrotask(() => emailRef?.focus());
  }

  return (
    <>
      <PageMeta
        title="Reset your password · Flonion"
        description="Get a link to reset your Flonion password."
        path="/forgot-password"
        noindex
      />

      <AuthShell
        skipTo={sentTo() ? "forgot-sent" : "forgot-form"}
        skipLabel="Skip to password reset form"
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
          when={sentTo()}
          fallback={
            <>
              <h1 class="font-display text-xl font-semibold text-text">
                Forgot your password?
              </h1>
              <p class="mt-1 text-base text-text-muted">
                Enter the email you use for Flonion and we'll send you a link to
                choose a new password.
              </p>

              <Show when={linkExpired()}>
                <p class="mt-5 flex items-start gap-2 rounded-md border border-warning/40 bg-accent-soft px-3 py-2.5 text-sm text-text">
                  <IconAlertTriangle
                    aria-hidden="true"
                    class="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  <span>
                    <span class="font-medium">
                      That reset link has expired or was already used.
                    </span>{" "}
                    Request a new one below.
                  </span>
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
                            <span class="font-medium">Too many requests.</span>{" "}
                            Wait a minute and try again.
                          </p>
                        </Match>
                      </Switch>
                    </div>
                  )}
                </Show>
              </div>

              <form
                id="forgot-form"
                method="post"
                novalidate
                onSubmit={onSubmit}
                class="mt-6 flex flex-col gap-5"
              >
                <div class="flex flex-col gap-1.5">
                  <label for="forgot-email" class={labelClass}>
                    Email
                  </label>
                  <input
                    ref={emailRef}
                    id="forgot-email"
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
                      setEmailError(undefined);
                    }}
                    aria-invalid={Boolean(emailError())}
                    aria-describedby={
                      emailError() ? "forgot-email-error" : undefined
                    }
                    class={inputBase}
                  />
                  <FieldError id="forgot-email-error" message={emailError()} />
                </div>

                <button
                  type="submit"
                  disabled={pending()}
                  aria-disabled={pending()}
                  class={submitClass}
                >
                  <Show when={pending()} fallback="Send reset link">
                    <IconLoader2
                      aria-hidden="true"
                      class="size-5 motion-safe:animate-spin"
                    />
                    Sending link…
                  </Show>
                </button>
              </form>
            </>
          }
        >
          {(to) => (
            <div id="forgot-sent" class="flex flex-col items-start">
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
                If a Flonion account uses{" "}
                <span class="font-medium break-all text-text">{to()}</span>,
                we've sent it a link to reset the password. The link works for 1
                hour.
              </p>
              <p class="mt-3 text-sm text-text-muted">
                Nothing after a few minutes? Check your spam folder, or make
                sure this is the email you signed up with.
              </p>

              <div class="mt-6 flex w-full flex-col gap-3">
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown() > 0 || pending()}
                  class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-border-strong px-5 font-display text-base font-semibold text-text transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent"
                >
                  <Switch fallback="Send another link">
                    <Match when={pending()}>
                      <IconLoader2
                        aria-hidden="true"
                        class="size-5 motion-safe:animate-spin"
                      />
                      Sending…
                    </Match>
                    <Match when={cooldown() > 0}>
                      Send another link in{" "}
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
                      Another link is on its way.
                    </span>
                  </Match>
                  <Match when={resendStatus() === "rate-limit"}>
                    <span class="flex items-center gap-1.5 text-error">
                      <IconAlertTriangle
                        aria-hidden="true"
                        class="size-4 shrink-0"
                      />
                      Too many requests. Wait a minute and try again.
                    </span>
                  </Match>
                  <Match when={resendStatus() === "error"}>
                    <span class="flex items-center gap-1.5 text-error">
                      <IconCircleX aria-hidden="true" class="size-4 shrink-0" />
                      We couldn't send another link. Try again shortly.
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
