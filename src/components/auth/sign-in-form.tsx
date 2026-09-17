import { Field } from "@ark-ui/solid/field";
import { PasswordInput } from "@ark-ui/solid/password-input";
import Check from "lucide-solid/icons/check";
import CircleAlert from "lucide-solid/icons/circle-alert";
import EyeIcon from "lucide-solid/icons/eye";
import EyeOffIcon from "lucide-solid/icons/eye-off";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import LogIn from "lucide-solid/icons/log-in";
import {
  type Component,
  createSignal,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import {
  authErrorCode,
  authErrorMessage,
  EMAIL_NOT_VERIFIED,
  isRateLimitError,
  RATE_LIMIT_MESSAGE,
} from "@/lib/auth-errors";
import type { FormStatus, SignInFormProps } from "@/types/auth-ui";

const SUCCESS_RESET_DELAY_MS = 2000;

/**
 * Flonion DS §6 "Auth set": single-column form rendered inside a
 * 440px card (route). Controls use 8px radius (rounded-sm),
 * 44px min touch targets (min-h-11), 16px inputs (no iOS zoom),
 * visible labels, icon + text errors (never colour-only, §1.4.1).
 */
export const SignInForm: Component<SignInFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>("idle");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [errorCode, setErrorCode] = createSignal<string | null>(null);

  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  const isInteractive = () => status() === "idle";

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setStatus("loading");
    setErrorMessage(null);
    setErrorCode(null);

    try {
      await props.onSubmit?.(email(), password());
      setStatus("success");
      successTimer = setTimeout(() => {
        setStatus("idle");
        setEmail("");
        setPassword("");
      }, SUCCESS_RESET_DELAY_MS);
    } catch (e) {
      const message = isRateLimitError(e)
        ? RATE_LIMIT_MESSAGE
        : authErrorMessage(e, "Sign in failed. Please try again.");
      setErrorMessage(message);
      setErrorCode(authErrorCode(e));
      props.onError?.(message);
      setStatus("idle");
    }
  };

  return (
    <div class="w-full">
      <form
        class="w-full space-y-4"
        onSubmit={handleSubmit}
        aria-busy={status() === "loading"}
        noValidate={false}
      >
        <Field.Root>
          <Field.Label
            for="signin-email"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email address
          </Field.Label>
          <Field.Input
            id="signin-email"
            name="email"
            type="email"
            required
            placeholder="e.g. jane@example.com"
            value={email()}
            autocomplete="email"
            inputmode="email"
            disabled={!isInteractive()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="min-h-11 w-full rounded-sm border border-input bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60"
          />
        </Field.Root>

        <Field.Root>
          <PasswordInput.Root>
            <div class="mb-1.5 flex items-baseline justify-between gap-4">
              <Field.Label
                for="signin-password"
                class="block text-sm font-medium text-foreground"
              >
                Password
              </Field.Label>
              <a
                href={props.forgotPasswordHref ?? "/forgot-password"}
                class="min-h-11 shrink-0 content-center text-sm font-medium text-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Forgot password?
              </a>
            </div>
            <PasswordInput.Control class="flex min-h-11 w-full items-center rounded-sm border border-input bg-card px-4 transition-colors focus-within:border-primary">
              <PasswordInput.Input
                id="signin-password"
                name="password"
                required
                placeholder="Enter your password"
                autocomplete="current-password"
                disabled={!isInteractive()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                class="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
              />
              <PasswordInput.VisibilityTrigger
                disabled={!isInteractive()}
                aria-label="Show password"
                class="ml-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <PasswordInput.Indicator
                  fallback={<EyeOffIcon class="h-4 w-4" aria-hidden="true" />}
                >
                  <EyeIcon class="h-4 w-4" aria-hidden="true" />
                </PasswordInput.Indicator>
              </PasswordInput.VisibilityTrigger>
            </PasswordInput.Control>
          </PasswordInput.Root>
        </Field.Root>

        <Show when={errorMessage()}>
          <div
            role="alert"
            class="flex items-start gap-2.5 rounded-sm border border-destructive/25 bg-destructive-muted p-3 text-sm"
          >
            <CircleAlert
              class="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="font-medium text-destructive">{errorMessage()}</p>
              {errorCode() === EMAIL_NOT_VERIFIED && (
                <a
                  href={`/verify-email?email=${encodeURIComponent(email())}`}
                  class="mt-1 inline-block min-h-11 font-medium text-destructive underline underline-offset-2 transition-colors hover:opacity-80 sm:min-h-0"
                >
                  Resend verification email
                </a>
              )}
            </div>
          </div>
        </Show>

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === "loading"}
          aria-live="polite"
          class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch fallback={<span>{props.submitLabel ?? "Sign in"}</span>}>
            <Match when={status() === "loading"}>
              <LoaderCircleIcon
                class="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              <span>Signing in…</span>
            </Match>
            <Match when={status() === "success"}>
              <Check class="h-5 w-5" aria-hidden="true" />
              <span>Success!</span>
            </Match>
            <Match when={status() === "idle"}>
              <LogIn class="h-4 w-4" aria-hidden="true" />
              <span>{props.submitLabel ?? "Sign in"}</span>
            </Match>
          </Switch>
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        {props.redirectText ?? "Don't have an account?"}{" "}
        <a
          href={props.redirectTo ?? "/signup"}
          class="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {props.redirectLabel ?? "Sign up"}
        </a>
      </p>
    </div>
  );
};
