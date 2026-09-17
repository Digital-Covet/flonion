import { useSearchParams } from "@solidjs/router";
import Lock from "lucide-solid/icons/lock";
import MailPlus from "lucide-solid/icons/mail-plus";
import { Show } from "solid-js";
import { BrandMark, Footer, SignInForm } from "@/components/auth";
import { authClient } from "@/lib/auth-client";
import {
  AuthError,
  authErrorCode,
  EMAIL_NOT_VERIFIED,
} from "~/lib/auth-errors";
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
 * Jost headings, Rubik body, 8px controls / 12px card, 44px targets,
 * 2px Primary focus (global), icon + text states, E2 card entry.
 */
export default function LoginPage() {
  // An invited user arrives here mid-flow; the token has to survive the sign-in.
  const [searchParams] = useSearchParams();
  const inviteToken = () => pickInviteToken(searchParams.invite);

  const handleEmailSubmit = async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: inviteCallbackUrl(inviteToken(), "/dashboard"),
    });
    if (error) {
      // Not `status === 403`: an untrusted origin or callbackURL fails with the
      // same status, and relabelling those as unverified sent verified users to
      // the resend-verification page.
      const code = authErrorCode(error);
      if (code === EMAIL_NOT_VERIFIED) {
        throw new AuthError(
          "Email is not verified. Please verify your email before signing in.",
          code,
        );
      }
      throw new AuthError(
        error.message || "Sign in failed. Please try again.",
        code,
      );
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:py-12">
      <div class="e2-enter flex w-full max-w-[440px] flex-col items-center">
        <BrandMark />

        <Show when={inviteToken()}>
          <div
            role="status"
            class="mt-6 flex w-full items-start gap-2.5 rounded-md border border-info-text/20 bg-info-muted p-3 text-sm"
          >
            <MailPlus
              class="mt-0.5 h-4 w-4 shrink-0 text-info-text"
              aria-hidden="true"
            />
            <p class="text-foreground">
              <span class="font-medium">You've been invited to a team.</span>{" "}
              <span class="text-muted-foreground">
                Sign in to accept the invite.
              </span>
            </p>
          </div>
        </Show>

        <section
          aria-labelledby="login-heading"
          class="mt-6 w-full rounded-md border border-border bg-card p-5 shadow-md sm:p-6"
        >
          <header class="mb-6 text-center">
            <h1
              id="login-heading"
              class="font-heading text-2xl font-semibold text-foreground"
            >
              Welcome back
            </h1>
            <p class="mt-1.5 text-base text-muted-foreground">
              Sign in to manage your reviews
            </p>
          </header>
          <SignInForm
            onSubmit={handleEmailSubmit}
            redirectTo={withInvite("/signup", inviteToken())}
            redirectLabel="Sign up"
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
