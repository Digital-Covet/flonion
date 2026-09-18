import { Meta, Title } from "@solidjs/meta";
import { A, Navigate, useNavigate, useSearchParams } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
  IconKey,
  IconLoader2,
} from "@tabler/icons-solidjs";
import { createSignal, type JSX, Match, onMount, Show, Switch } from "solid-js";
import {
  AuthShell,
  FieldError,
  labelClass,
  PasswordInput,
  submitClass,
  textLink,
} from "~/components/auth/AuthShell";
import { authClient } from "~/lib/auth-client";
import { authErrorCode, isRateLimitError } from "~/lib/auth-errors";
import { cn } from "~/lib/cn";

// better-auth defaults (emailAndPassword.min/maxPasswordLength are unset).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const EXPIRED_HREF = "/forgot-password?error=INVALID_TOKEN";

type Fields = "password" | "confirm";
type Notice = { kind: "error"; message: string } | { kind: "rate-limit" };

/**
 * Landing page for the emailed link. better-auth's callback redirects here
 * with `?token=…` when the link is valid and `?error=INVALID_TOKEN` when it
 * is expired or used; both the latter and a token rejected on submit send the
 * person back to /forgot-password, which explains and offers a new link.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Read once: the token is stripped from the address bar on mount.
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = params.error ? "" : (rawToken ?? "");

  const [password, setPassword] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<
    Partial<Record<Fields, string>>
  >({});

  const refs: Partial<Record<Fields, HTMLInputElement>> = {};
  let noticeRef: HTMLDivElement | undefined;
  let doneHeadingRef: HTMLHeadingElement | undefined;

  const longEnough = () => password().length >= MIN_PASSWORD;
  const matches = () => confirm().length > 0 && confirm() === password();

  onMount(() => {
    // Keep the single-use token out of history, bookmarks and shared screens.
    if (token) window.history.replaceState(null, "", "/reset-password");
  });

  function clearFieldError(field: Fields) {
    setFieldErrors(({ [field]: _, ...rest }) => rest);
  }

  function validate() {
    const errors: Partial<Record<Fields, string>> = {};
    if (!password()) errors.password = "Create a new password.";
    else if (password().length < MIN_PASSWORD)
      errors.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (password().length > MAX_PASSWORD)
      errors.password = `Use ${MAX_PASSWORD} characters or fewer.`;

    if (!confirm()) errors.confirm = "Type the new password again.";
    else if (confirm() !== password())
      errors.confirm = "The passwords don't match.";

    setFieldErrors(errors);
    const first = (["password", "confirm"] as const).find((f) => errors[f]);
    if (first) refs[first]?.focus();
    return !first;
  }

  function showNotice(next: Notice) {
    setNotice(next);
    queueMicrotask(() => noticeRef?.focus());
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
      const { error } = await authClient.resetPassword({
        newPassword: password(),
        token,
      });
      if (error) {
        const code = authErrorCode(error);
        if (code === "INVALID_TOKEN") {
          navigate(EXPIRED_HREF, { replace: true });
        } else if (isRateLimitError(error)) {
          showNotice({ kind: "rate-limit" });
        } else if (code === "PASSWORD_TOO_SHORT") {
          setFieldErrors({
            password: `Use at least ${MIN_PASSWORD} characters.`,
          });
          refs.password?.focus();
        } else if (code === "PASSWORD_TOO_LONG") {
          setFieldErrors({
            password: `Use ${MAX_PASSWORD} characters or fewer.`,
          });
          refs.password?.focus();
        } else {
          showNotice({
            kind: "error",
            message: "We couldn't update your password. Try again shortly.",
          });
        }
        return;
      }
      setPassword("");
      setConfirm("");
      setDone(true);
      queueMicrotask(() => doneHeadingRef?.focus());
    } catch {
      showNotice({
        kind: "error",
        message:
          "We couldn't reach Flonion. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Title>Choose a new password · Flonion</Title>
      <Meta
        name="description"
        content="Choose a new password for your Flonion account."
      />
      {/* The token is in the URL on first load; don't leak it to other sites. */}
      <Meta name="referrer" content="no-referrer" />

      <Show when={token} fallback={<Navigate href={EXPIRED_HREF} />}>
        <AuthShell
          skipTo={done() ? "reset-done" : "reset-form"}
          skipLabel={done() ? "Skip to confirmation" : "Skip to form"}
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
            when={done()}
            fallback={
              <>
                <h1 class="font-display text-xl font-semibold text-text">
                  Choose a new password
                </h1>
                <p class="mt-1 text-base text-text-muted">
                  Pick something you haven't used for Flonion before. You'll use
                  it to log in from now on.
                </p>

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
                              <span class="font-medium">
                                Too many attempts.
                              </span>{" "}
                              Wait a minute and try again.
                            </p>
                          </Match>
                        </Switch>
                      </div>
                    )}
                  </Show>
                </div>

                <form
                  id="reset-form"
                  method="post"
                  novalidate
                  onSubmit={onSubmit}
                  class="mt-6 flex flex-col gap-5"
                >
                  <div class="flex flex-col gap-1.5">
                    <label for="reset-password" class={labelClass}>
                      New password
                    </label>
                    <PasswordInput
                      ref={(el) => {
                        refs.password = el;
                      }}
                      id="reset-password"
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
                        "reset-password-hint",
                        fieldErrors().password && "reset-password-error",
                      )}
                    />
                    <Requirement id="reset-password-hint" met={longEnough()}>
                      At least {MIN_PASSWORD} characters
                    </Requirement>
                    <FieldError
                      id="reset-password-error"
                      message={fieldErrors().password}
                    />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label for="reset-confirm" class={labelClass}>
                      Confirm new password
                    </label>
                    <PasswordInput
                      ref={(el) => {
                        refs.confirm = el;
                      }}
                      id="reset-confirm"
                      name="confirm-password"
                      autocomplete="new-password"
                      required
                      maxlength={MAX_PASSWORD}
                      value={confirm()}
                      onInput={(e) => {
                        setConfirm(e.currentTarget.value);
                        clearFieldError("confirm");
                      }}
                      aria-invalid={Boolean(fieldErrors().confirm)}
                      aria-describedby={cn(
                        "reset-confirm-hint",
                        fieldErrors().confirm && "reset-confirm-error",
                      )}
                    />
                    <Requirement id="reset-confirm-hint" met={matches()}>
                      Both passwords match
                    </Requirement>
                    <FieldError
                      id="reset-confirm-error"
                      message={fieldErrors().confirm}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pending()}
                    aria-disabled={pending()}
                    class={submitClass}
                  >
                    <Show when={pending()} fallback="Update password">
                      <IconLoader2
                        aria-hidden="true"
                        class="size-5 motion-safe:animate-spin"
                      />
                      Updating password…
                    </Show>
                  </button>
                </form>
              </>
            }
          >
            <div id="reset-done" class="flex flex-col items-start">
              <span class="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
                <IconKey aria-hidden="true" class="size-6" />
              </span>
              <h1
                ref={doneHeadingRef}
                tabindex="-1"
                class="mt-4 font-display text-xl font-semibold text-text outline-none"
              >
                Your password is updated
              </h1>
              <p class="mt-2 text-base text-text-muted">
                Log in with your new password to get back to your dashboard.
              </p>
              <p class="mt-3 flex items-start gap-2 text-sm text-text-muted">
                <IconCircleCheck
                  aria-hidden="true"
                  class="mt-0.5 size-4 shrink-0 text-success"
                />
                The reset link has been used and won't work again.
              </p>
              <A href="/login" class={cn(submitClass, "mt-6")}>
                Log in
              </A>
            </div>
          </Show>
        </AuthShell>
      </Show>
    </>
  );
}

/** Live requirement line: dot while unmet, check icon + success colour once met. */
function Requirement(props: {
  id: string;
  met: boolean;
  children: JSX.Element;
}) {
  return (
    <p
      id={props.id}
      class={cn(
        "flex items-center gap-1.5 text-sm",
        props.met ? "text-success" : "text-text-muted",
      )}
    >
      <Show
        when={props.met}
        fallback={
          <span
            aria-hidden="true"
            class="grid size-4 shrink-0 place-items-center"
          >
            <span class="size-1.5 rounded-full bg-current" />
          </span>
        }
      >
        <IconCircleCheck aria-hidden="true" class="size-4 shrink-0" />
      </Show>
      {props.children}
    </p>
  );
}
