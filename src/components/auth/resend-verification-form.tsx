import { Field } from "@ark-ui/solid/field";
import Check from "lucide-solid/icons/check";
import CircleAlert from "lucide-solid/icons/circle-alert";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import Send from "lucide-solid/icons/send";
import { type Component, createSignal, Match, Show, Switch } from "solid-js";
import {
  authErrorMessage,
  isRateLimitError,
  RATE_LIMIT_MESSAGE,
} from "@/lib/auth-errors";
import type { FormStatus, ResendVerificationFormProps } from "@/types/auth-ui";

export const ResendVerificationForm: Component<ResendVerificationFormProps> = (
  props,
) => {
  const [status, setStatus] = createSignal<FormStatus>("idle");
  const [email, setEmail] = createSignal(props.initialEmail ?? "");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const isInteractive = () => status() === "idle";

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      await props.onSubmit?.(email());
      setStatus("success");
    } catch (e) {
      setErrorMessage(
        isRateLimitError(e)
          ? RATE_LIMIT_MESSAGE
          : authErrorMessage(
              e,
              "Failed to send verification email. Please try again.",
            ),
      );
      setStatus("idle");
    }
  };

  return (
    <div class="w-full">
      <form
        class="w-full space-y-4"
        onSubmit={handleSubmit}
        aria-busy={status() === "loading"}
      >
        <Field.Root>
          <Field.Label
            for="resend-email"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email address
          </Field.Label>
          <Field.Input
            id="resend-email"
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

        <Show when={errorMessage()}>
          <p
            role="alert"
            class="flex items-start gap-2 rounded-sm border border-destructive/25 bg-destructive-muted p-3 text-sm font-medium text-destructive"
          >
            <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {errorMessage()}
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
            fallback={
              <span>{props.submitLabel ?? "Resend verification email"}</span>
            }
          >
            <Match when={status() === "loading"}>
              <LoaderCircleIcon
                class="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              <span>Sending…</span>
            </Match>
            <Match when={status() === "success"}>
              <Check class="h-5 w-5" aria-hidden="true" />
              <span>Check your email</span>
            </Match>
            <Match when={status() === "idle"}>
              <Send class="h-4 w-4" aria-hidden="true" />
              <span>{props.submitLabel ?? "Resend verification email"}</span>
            </Match>
          </Switch>
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        {props.redirectText ?? "Already verified?"}{" "}
        <a
          href={props.redirectTo ?? "/login"}
          class="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {props.redirectLabel ?? "Back to login"}
        </a>
      </p>
    </div>
  );
};
