import { useSearchParams } from "@solidjs/router";
import Lock from "lucide-solid/icons/lock";
import MailCheck from "lucide-solid/icons/mail-check";
import { BrandMark, Footer, ResendVerificationForm } from "@/components/auth";
import { authClient } from "@/lib/auth-client";
import {
  inviteCallbackUrl,
  pickInviteToken,
  withInvite,
} from "~/lib/invite-redirect";
import type { FooterLink } from "~/types/auth-ui";

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Help", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
] as const;

/**
 * Flonion DS §6 "Auth set": single column, max 440px, centred card.
 * Address rendered in JetBrains Mono (DS §2 monospace for data).
 */
export default function VerifyEmailPage() {
  const getInitialEmail = () => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") ?? "";
  };

  const [searchParams] = useSearchParams();
  const inviteToken = () => pickInviteToken(searchParams.invite);

  // A resend re-issues the link, so it has to carry the invite token too —
  // otherwise resending strands the invitee back on the onboarding form.
  const verifyCallbackUrl = () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:5173";
    return `${origin}${inviteCallbackUrl(inviteToken(), "/onboarding")}`;
  };

  const handleResend = async (email: string) => {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: verifyCallbackUrl(),
    });
    if (error) {
      throw new Error(
        error.message || "Failed to send verification email. Please try again.",
      );
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:py-12">
      <div class="e2-enter flex w-full max-w-[440px] flex-col items-center">
        <BrandMark />

        <section
          aria-labelledby="verify-heading"
          class="mt-6 w-full rounded-md border border-border bg-card p-5 shadow-md sm:p-6"
        >
          <header class="mb-6 text-center">
            <div class="mb-4 flex justify-center">
              <div
                class="flex size-12 items-center justify-center rounded-sm bg-primary/10"
                aria-hidden="true"
              >
                <MailCheck class="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1
              id="verify-heading"
              class="font-heading text-2xl font-semibold text-foreground"
            >
              Check your email
            </h1>
            <p class="mt-1.5 text-base text-muted-foreground">
              We've sent a verification link to{" "}
              <span class="font-mono text-sm text-foreground">
                {getInitialEmail() || "your email"}
              </span>
              . Click the link to verify your account, or resend below.
            </p>
          </header>
          <ResendVerificationForm
            onSubmit={handleResend}
            initialEmail={getInitialEmail()}
            redirectTo={withInvite("/login", inviteToken())}
            redirectLabel="Back to login"
          />
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
