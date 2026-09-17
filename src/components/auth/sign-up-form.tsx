import { Field } from "@ark-ui/solid/field";
import { PasswordInput } from "@ark-ui/solid/password-input";
import Check from "lucide-solid/icons/check";
import CircleAlert from "lucide-solid/icons/circle-alert";
import EyeIcon from "lucide-solid/icons/eye";
import EyeOffIcon from "lucide-solid/icons/eye-off";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import Sparkles from "lucide-solid/icons/sparkles";
import {
  type Component,
  createSignal,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { authErrorMessage } from "@/lib/auth-errors";
import type { FormStatus, SignUpFormProps } from "@/types/auth-ui";

const PASSWORD_MIN_LENGTH = 8;

type PasswordStrength = 0 | 1 | 2 | 3 | 4;

const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; bar: string; text: string }
> = {
  0: { label: "", bar: "bg-border", text: "text-muted-foreground" },
  1: { label: "Weak", bar: "bg-destructive", text: "text-destructive" },
  2: { label: "Fair", bar: "bg-warning", text: "text-warning" },
  3: { label: "Good", bar: "bg-warning", text: "text-warning" },
  4: { label: "Strong", bar: "bg-success", text: "text-success" },
};

function evaluatePasswordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as PasswordStrength;
}

const hasMinLength = (pw: string) => pw.length >= PASSWORD_MIN_LENGTH;
const hasUpperCase = (pw: string) => /[A-Z]/.test(pw);
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSymbol = (pw: string) => /[^A-Za-z0-9]/.test(pw);

const Requirement: Component<{ met: boolean; label: string }> = (props) => (
  <li
    class={`flex min-h-11 items-center gap-1.5 text-xs transition-colors sm:min-h-0 ${
      props.met ? "text-success" : "text-muted-foreground"
    }`}
  >
    <span
      aria-hidden="true"
      class={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
        props.met ? "border-success bg-success/10" : "border-input"
      }`}
    >
      <Check
        class={`h-3 w-3 ${props.met ? "opacity-100" : "opacity-30"}`}
        aria-hidden="true"
      />
    </span>
    <span>{props.label}</span>
    <span class="sr-only">{props.met ? " (met)" : " (not met)"}</span>
  </li>
);

/**
 * Flonion DS §6 "Auth set" sign-up form. 8px control radius,
 * 44px touch targets, visible labels, icon + text validation
 * (never colour-only), strength shown as label + bar.
 */
export const SignUpForm: Component<SignUpFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>("idle");
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [touchedFields, setTouchedFields] = createSignal<Set<string>>(
    new Set(),
  );

  onCleanup(() => {});

  const isInteractive = () => status() === "idle";
  const strength = () => evaluatePasswordStrength(password());

  const markTouched = (field: string) => {
    setTouchedFields((prev) => new Set([...prev, field]));
  };

  const isTouched = (field: string) => touchedFields().has(field);

  const nameError = (): string | null => {
    if (!isTouched("name")) return null;
    if (!name().trim()) return "Name is required";
    return null;
  };

  const emailError = (): string | null => {
    if (!isTouched("email")) return null;
    const trimmed = email().trim();
    if (!trimmed) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return "Enter a valid email address";
    return null;
  };

  const passwordError = (): string | null => {
    if (!isTouched("password")) return null;
    if (password().length === 0) return "Password is required";
    return null;
  };

  const validate = (): string | null => {
    if (!name().trim()) return "Name is required";
    if (!email().trim()) return "Email is required";
    if (password().length < PASSWORD_MIN_LENGTH)
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    if (!hasUpperCase(password()))
      return "Password must contain at least one uppercase letter";
    if (!hasNumber(password()))
      return "Password must contain at least one number";
    if (!hasSymbol(password()))
      return "Password must contain at least one symbol (@#&!)";
    return null;
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setTouchedFields(new Set(["name", "email", "password"]));
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("loading");

    try {
      await props.onSubmit?.(email(), password(), name().trim());
    } catch (e) {
      setError(authErrorMessage(e, "Sign up failed. Please try again."));
      setStatus("idle");
    }
  };

  const inputClass = (invalid: boolean) =>
    `min-h-11 w-full rounded-sm border bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60 ${
      invalid ? "border-destructive" : "border-input"
    }`;

  return (
    <div class="w-full">
      <form
        class="w-full space-y-4"
        onSubmit={handleSubmit}
        aria-busy={status() === "loading"}
      >
        <Field.Root invalid={!!nameError()}>
          <Field.Label
            for="signup-name"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            Full name
          </Field.Label>
          <Field.Input
            id="signup-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Jane Cooper"
            value={name()}
            autocomplete="name"
            disabled={!isInteractive()}
            onInput={(event) => setName(event.currentTarget.value)}
            onBlur={() => markTouched("name")}
            aria-invalid={!!nameError()}
            aria-describedby={nameError() ? "signup-name-error" : undefined}
            class={inputClass(!!nameError())}
          />
          <Show when={nameError()}>
            <Field.ErrorText
              id="signup-name-error"
              class="mt-1.5 flex items-center gap-1.5 text-sm text-destructive"
            >
              <CircleAlert class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {nameError()}
            </Field.ErrorText>
          </Show>
        </Field.Root>

        <Field.Root invalid={!!emailError()}>
          <Field.Label
            for="signup-email"
            class="mb-1.5 block text-sm font-medium text-foreground"
          >
            Work email
          </Field.Label>
          <Field.Input
            id="signup-email"
            name="email"
            type="email"
            required
            placeholder="e.g. jane@myshop.com"
            value={email()}
            autocomplete="email"
            inputmode="email"
            disabled={!isInteractive()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            onBlur={() => markTouched("email")}
            aria-invalid={!!emailError()}
            aria-describedby={emailError() ? "signup-email-error" : undefined}
            class={inputClass(!!emailError())}
          />
          <Show when={emailError()}>
            <Field.ErrorText
              id="signup-email-error"
              class="mt-1.5 flex items-center gap-1.5 text-sm text-destructive"
            >
              <CircleAlert class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {emailError()}
            </Field.ErrorText>
          </Show>
        </Field.Root>

        <Field.Root invalid={!!passwordError()}>
          <PasswordInput.Root>
            <Field.Label
              for="signup-password"
              class="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </Field.Label>
            <PasswordInput.Control
              class={`flex min-h-11 w-full items-center rounded-sm border bg-card px-4 transition-colors focus-within:border-primary ${
                passwordError() ? "border-destructive" : "border-input"
              }`}
            >
              <PasswordInput.Input
                id="signup-password"
                name="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                placeholder="Create a password"
                autocomplete="new-password"
                disabled={!isInteractive()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                onBlur={() => markTouched("password")}
                aria-describedby="signup-password-hints"
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

          <ul
            id="signup-password-hints"
            class="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2"
            aria-label="Password requirements"
          >
            <Requirement met={hasMinLength(password())} label="8+ characters" />
            <Requirement met={hasUpperCase(password())} label="One uppercase" />
            <Requirement met={hasNumber(password())} label="One number" />
            <Requirement
              met={hasSymbol(password())}
              label="One symbol (@#&!)"
            />
          </ul>

          <Show when={password().length > 0}>
            <div class="mt-2" aria-live="polite">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-xs text-muted-foreground">
                  Password strength
                </span>
                <span
                  class={`text-xs font-medium ${STRENGTH_CONFIG[strength()].text}`}
                >
                  {STRENGTH_CONFIG[strength()].label}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={strength()}
                aria-label={`Password strength: ${STRENGTH_CONFIG[strength()].label || "empty"}`}
                class="h-1 w-full overflow-hidden rounded-full bg-border"
              >
                <div
                  class={`h-full transition-[width] duration-200 ${STRENGTH_CONFIG[strength()].bar}`}
                  style={{ width: `${(strength() / 4) * 100}%` }}
                />
              </div>
            </div>
          </Show>

          <Show when={passwordError()}>
            <Field.ErrorText class="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {passwordError()}
            </Field.ErrorText>
          </Show>
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
            fallback={<span>{props.submitLabel ?? "Create account"}</span>}
          >
            <Match when={status() === "loading"}>
              <LoaderCircleIcon
                class="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              <span>Creating account…</span>
            </Match>
            <Match when={status() === "idle"}>
              <Sparkles class="h-4 w-4" aria-hidden="true" />
              <span>{props.submitLabel ?? "Create account"}</span>
            </Match>
          </Switch>
        </button>

        <p class="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <a
            href="/terms"
            class="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            class="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        {props.redirectText ?? "Already have an account?"}{" "}
        <a
          href={props.redirectTo ?? "/login"}
          class="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {props.redirectLabel ?? "Sign in"}
        </a>
      </p>
    </div>
  );
};
