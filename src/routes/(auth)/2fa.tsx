import { Field } from "@ark-ui/solid/field";
import { Title } from "@solidjs/meta";
import CircleAlert from "lucide-solid/icons/circle-alert";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import Lock from "lucide-solid/icons/lock";
import ShieldCheck from "lucide-solid/icons/shield-check";
import Timer from "lucide-solid/icons/timer";
import { createSignal, Show } from "solid-js";
import { BrandMark, Footer } from "@/components/auth";
import { authClient } from "@/lib/auth-client";
import { isRateLimitError, RATE_LIMIT_MESSAGE } from "@/lib/auth-errors";
import type { FooterLink } from "~/types/auth-ui";

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;

const CODE_LENGTH = 6;

type SubmitStatus = "idle" | "loading" | "success" | "error";

/**
 * Flonion DS §6 "Auth set": single column, max 440px, centred card.
 * Lockout (429-style) surfaces as an explicit wait-and-retry message
 * with icon + text — never another bare "invalid code".
 */
export default function TwoFactorPage() {
  const [code, setCode] = createSignal("");
  const [status, setStatus] = createSignal<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [lockedOut, setLockedOut] = createSignal(false);

  const isInteractive = () => status() === "idle" || status() === "error";
  const codeDigits = () => code().replace(/\D/g, "").slice(0, CODE_LENGTH);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isInteractive()) return;

    setStatus("loading");
    setErrorMessage(null);
    setLockedOut(false);

    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: codeDigits(),
        trustDevice: true,
      });

      if (error) {
        // Rate-limit/lockout surfaces as a 429-style error — report the
        // wait instead of another "invalid code".
        const locked = isRateLimitError(error);
        setLockedOut(locked);
        setErrorMessage(
          locked
            ? RATE_LIMIT_MESSAGE
            : error.message || "Invalid code. Please try again.",
        );
        setStatus("error");
        return;
      }

      setStatus("success");
      window.location.href = "/dashboard";
    } catch {
      setLockedOut(false);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <Title>Two-Factor Authentication</Title>
      <main class="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:py-12">
        <div class="e2-enter flex w-full max-w-[440px] flex-col items-center">
          <BrandMark />

          <section
            aria-labelledby="2fa-heading"
            class="mt-6 w-full rounded-md border border-border bg-card p-5 shadow-md sm:p-6"
          >
            <header class="mb-6 text-center">
              <div class="mb-4 flex justify-center">
                <div
                  class="flex size-12 items-center justify-center rounded-sm bg-primary/10"
                  aria-hidden="true"
                >
                  <ShieldCheck class="h-6 w-6 text-primary" />
                </div>
              </div>
              <h1
                id="2fa-heading"
                class="font-heading text-2xl font-semibold text-foreground"
              >
                Two-factor authentication
              </h1>
              <p class="mt-1.5 text-base text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </header>

            <form
              class="w-full space-y-4"
              onSubmit={handleSubmit}
              aria-busy={status() === "loading"}
            >
              <Field.Root invalid={status() === "error"}>
                <Field.Label
                  for="totp-code"
                  class="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Verification code
                </Field.Label>
                <Field.Input
                  id="totp-code"
                  name="totp-code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength={CODE_LENGTH}
                  required
                  placeholder="000000"
                  autocomplete="one-time-code"
                  aria-describedby={
                    status() === "error" ? "totp-code-error" : undefined
                  }
                  disabled={!isInteractive()}
                  value={code()}
                  onInput={(e) => setCode((e.target as HTMLInputElement).value)}
                  class="tnum min-h-11 w-full rounded-sm border border-input bg-card px-4 text-center font-mono text-xl tracking-[0.5em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60"
                />
                <Show when={status() === "error" && errorMessage()}>
                  <Field.ErrorText
                    id="totp-code-error"
                    class="mt-2 flex items-start gap-2 rounded-sm border border-destructive/25 bg-destructive-muted p-3 text-sm font-medium text-destructive"
                  >
                    {lockedOut() ? (
                      <Timer
                        class="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleAlert
                        class="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {errorMessage()}
                  </Field.ErrorText>
                </Show>
              </Field.Root>

              <button
                type="submit"
                disabled={!isInteractive() || codeDigits().length < CODE_LENGTH}
                aria-busy={status() === "loading"}
                aria-live="polite"
                class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Show
                  fallback={<span>Verify and continue</span>}
                  when={status() === "loading"}
                >
                  <LoaderCircleIcon
                    class="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Verifying…</span>
                </Show>
              </button>

              <p class="text-center text-xs leading-relaxed text-muted-foreground">
                This device will be remembered for 30 days.
              </p>
            </form>

            <p class="mt-6 text-center text-sm text-muted-foreground">
              Lost access to your authenticator?{" "}
              <a
                href="/login"
                class="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Back to sign in
              </a>
            </p>
          </section>

          <p class="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock class="h-3.5 w-3.5" aria-hidden="true" />
            Your reviews and business data stay private to your team.
          </p>

          <Footer links={FOOTER_LINKS} />
        </div>
      </main>
    </>
  );
}
