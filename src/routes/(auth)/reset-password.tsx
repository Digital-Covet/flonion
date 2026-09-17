import { useLocation } from "@solidjs/router";
import Lock from "lucide-solid/icons/lock";
import { BrandMark, Footer, ResetPasswordForm } from "@/components/auth";
import { authClient } from "@/lib/auth-client";
import { AuthError } from "@/lib/auth-errors";
import type { FooterLink } from "~/types/auth-ui";

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;

/**
 * Flonion DS §6 "Auth set": single column, max 440px, centred card.
 * Invalid/expired tokens surface as an icon + text error in the form —
 * never a silent return to idle.
 */
export default function ResetPasswordPage() {
  const location = useLocation();
  const token = () => location.query.token as string | undefined;

  const handlePasswordSubmit = async (newPassword: string) => {
    const currentToken = token();
    if (!currentToken) {
      throw new AuthError(
        "This reset link is invalid or expired. Request a new one from the login page.",
      );
    }

    const { error } = await authClient.resetPassword({
      newPassword,
      token: currentToken,
    });
    if (error) {
      throw new AuthError(
        error.message ||
          "Couldn't reset your password. The link may have expired.",
      );
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:py-12">
      <div class="e2-enter flex w-full max-w-[440px] flex-col items-center">
        <BrandMark />

        <section
          aria-labelledby="reset-heading"
          class="mt-6 w-full rounded-md border border-border bg-card p-5 shadow-md sm:p-6"
        >
          <header class="mb-6 text-center">
            <h1
              id="reset-heading"
              class="font-heading text-2xl font-semibold text-foreground"
            >
              Set a new password
            </h1>
            <p class="mt-1.5 text-base text-muted-foreground">
              Choose a password with at least 8 characters
            </p>
          </header>
          <ResetPasswordForm onSubmit={handlePasswordSubmit} />
          <p class="mt-6 text-center text-sm text-muted-foreground">
            Link expired?{" "}
            <a
              href="/forgot-password"
              class="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Request a new one
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
  );
}
