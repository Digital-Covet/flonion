import { createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { Field } from "@ark-ui/solid/field";
import Shield from "lucide-solid/icons/shield";
import LoaderCircleIcon from "lucide-solid/icons/loader-circle";
import { BrandMark, Footer, IllustrationPanel } from "@/components/auth";
import { FooterLink } from "~/types/auth-ui";
import { authClient } from "@/lib/auth-client";

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;

const ILLUSTRATION_IMAGE_URL = "/auth-image.webp";

type SubmitStatus = "idle" | "loading" | "success" | "error";

export default function TwoFactorPage() {
  const [code, setCode] = createSignal("");
  const [status, setStatus] = createSignal<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const isInteractive = () => status() === "idle" || status() === "error";

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isInteractive()) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: code(),
        trustDevice: true,
      });

      if (error) {
        setErrorMessage(error.message || "Invalid code. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      window.location.href = "/dashboard";
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <Title>Two-Factor Authentication</Title>
      <main class="flex min-h-dvh flex-col bg-background md:flex-row">
        <IllustrationPanel
          imageSrc={ILLUSTRATION_IMAGE_URL}
          imageAlt="Security verification illustration"
        />

        <section class="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 md:py-6">
          <div class="flex w-full max-w-110 animate-[fade-in-up_0.5s_ease-out] flex-col items-center">
            <BrandMark />
            <header class="mb-6 w-full text-center">
              <div class="mb-4 flex justify-center">
                <div class="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <Shield size={28} class="text-primary" />
                </div>
              </div>
              <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">
                Two-Factor Authentication
              </h1>
              <p class="text-base text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </header>

            <form class="w-full space-y-4" onSubmit={handleSubmit}>
              <Field.Root invalid={status() === "error"}>
                <Field.Label
                  for="totp-code"
                  class="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Verification code
                </Field.Label>
                <Field.Input
                  id="totp-code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength={6}
                  required
                  placeholder="000000"
                  autocomplete="one-time-code"
                  disabled={!isInteractive()}
                  value={code()}
                  onInput={(e) => setCode((e.target as HTMLInputElement).value)}
                  class="w-full rounded-full border border-input bg-card px-6 py-4 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
                <Show when={errorMessage()}>
                  <Field.ErrorText class="mt-2 text-sm text-destructive">
                    {errorMessage()}
                  </Field.ErrorText>
                </Show>
              </Field.Root>

              <button
                type="submit"
                disabled={!isInteractive() || code().length < 6}
                aria-busy={status() === "loading"}
                aria-live="polite"
                class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Show
                  fallback={<span>Verify & Continue</span>}
                  when={status() === "loading"}
                >
                  <LoaderCircleIcon class="h-5 w-5 animate-spin" />
                  <span>Verifying...</span>
                </Show>
              </button>
            </form>

            <p class="mt-6 text-center text-sm text-muted-foreground">
              Lost access to your authenticator?{" "}
              <a
                href="/login"
                class="font-semibold text-foreground transition-colors hover:text-primary"
              >
                Back to sign in
              </a>
            </p>
          </div>
          <Footer links={FOOTER_LINKS} />
        </section>
      </main>
    </>
  );
}
