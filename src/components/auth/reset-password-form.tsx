import { Field } from "@ark-ui/solid/field";
import { PasswordInput } from "@ark-ui/solid/password-input";
import Check from "lucide-solid/icons/check";
import CircleAlert from "lucide-solid/icons/circle-alert";
import EyeIcon from "lucide-solid/icons/eye";
import EyeOffIcon from "lucide-solid/icons/eye-off";
import KeyRound from "lucide-solid/icons/key-round";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import {
  type Component,
  createSignal,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import {
  authErrorMessage,
  isRateLimitError,
  RATE_LIMIT_MESSAGE,
} from "@/lib/auth-errors";
import type { FormStatus, ResetPasswordFormProps } from "@/types/auth-ui";

const PASSWORD_MIN_LENGTH = 8;

export const ResetPasswordForm: Component<ResetPasswordFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>("idle");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");

  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  const isInteractive = () => status() === "idle";

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    if (newPassword() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword().length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }

    setError("");
    setStatus("loading");

    try {
      await props.onSubmit?.(newPassword());
      setStatus("success");
      successTimer = setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (e) {
      // Invalid/expired tokens and transport failures surface here — never a
      // silent return to idle (audit: "reset-password failure is silent").
      setError(
        isRateLimitError(e)
          ? RATE_LIMIT_MESSAGE
          : authErrorMessage(
              e,
              "Couldn't reset your password. The link may have expired — request a new one.",
            ),
      );
      setStatus("idle");
    }
  };

  const inputClass =
    "min-h-11 w-full rounded-sm border border-input bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60";

  return (
    <div class="w-full">
      <form
        class="w-full space-y-4"
        onSubmit={handleSubmit}
        aria-busy={status() === "loading"}
      >
        <Field.Root>
          <Field.Label
            for="reset-new-password"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            New password
          </Field.Label>
          <PasswordInput.Root>
            <PasswordInput.Control class="flex min-h-11 w-full items-center rounded-sm border border-input bg-card px-4 transition-colors focus-within:border-primary">
              <PasswordInput.Input
                id="reset-new-password"
                name="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                autocomplete="new-password"
                disabled={!isInteractive()}
                onInput={(event) => {
                  setNewPassword(event.currentTarget.value);
                  setError("");
                }}
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

        <Field.Root>
          <Field.Label
            for="reset-confirm-password"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            Confirm password
          </Field.Label>
          <Field.Input
            id="reset-confirm-password"
            name="confirm-password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            placeholder="Repeat the new password"
            autocomplete="new-password"
            disabled={!isInteractive()}
            onInput={(event) => {
              setConfirmPassword(event.currentTarget.value);
              setError("");
            }}
            class={inputClass}
          />
        </Field.Root>

        <Show when={error()}>
          <p
            role="alert"
            class="flex items-start gap-2 rounded-sm border border-destructive/25 bg-destructive-muted p-3 text-sm font-medium text-destructive"
          >
            <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error()}
          </p>
        </Show>

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === "loading"}
          aria-live="polite"
          class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch
            fallback={<span>{props.submitLabel ?? "Reset password"}</span>}
          >
            <Match when={status() === "loading"}>
              <LoaderCircleIcon
                class="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              <span>Resetting…</span>
            </Match>
            <Match when={status() === "success"}>
              <Check class="h-5 w-5" aria-hidden="true" />
              <span>Password reset!</span>
            </Match>
            <Match when={status() === "idle"}>
              <KeyRound class="h-4 w-4" aria-hidden="true" />
              <span>{props.submitLabel ?? "Reset password"}</span>
            </Match>
          </Switch>
        </button>
      </form>
    </div>
  );
};
