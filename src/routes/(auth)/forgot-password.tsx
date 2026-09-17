import Lock from "lucide-solid/icons/lock";
import { BrandMark, Footer, ForgotPasswordForm } from "@/components/auth";
import { authClient } from "@/lib/auth-client";
import type { FooterLink } from "~/types/auth-ui";

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;

const RESET_REDIRECT_URL = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"}/reset-password`;

/**
 * Flonion DS §6 "Auth set": single column, max 440px, centred card.
 * No account-existence leakage: success always reads "check your email".
 */
export default function ForgotPasswordPage() {
  const handleEmailSubmit = async (email: string) => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: RESET_REDIRECT_URL,
    });
    if (error) {
      console.error("[ForgotPasswordPage] Request failed:", error.message);
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:py-12">
      <div class="e2-enter flex w-full max-w-[440px] flex-col items-center">
        <BrandMark />

        <section
          aria-labelledby="forgot-heading"
          class="mt-6 w-full rounded-md border border-border bg-card p-5 shadow-md sm:p-6"
        >
          <header class="mb-6 text-center">
            <h1
              id="forgot-heading"
              class="font-heading text-2xl font-semibold text-foreground"
            >
              Reset your password
            </h1>
            <p class="mt-1.5 text-base text-muted-foreground">
              Enter your email and we'll send you a reset link
            </p>
          </header>
          <ForgotPasswordForm
            onSubmit={handleEmailSubmit}
            redirectTo="/login"
            redirectLabel="Back to login"
          />
          <p class="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
        </section>

        <p class="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock class="h-3.5 w-3.5" aria-hidden="true" />
          Your reviews and business data stay private to your team.
        </p>

        <Footer links={FOOTER_LINKS} />
      </div>
    </main>
  );
}
