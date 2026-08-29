import { BrandMark, ResendVerificationForm, Footer } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';
import { useSearchParams } from '@solidjs/router';
import { inviteCallbackUrl, pickInviteToken, withInvite } from '~/lib/invite-redirect';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

export default function VerifyEmailPage() {
  const getInitialEmail = () => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('email') ?? '';
  };

  const [searchParams] = useSearchParams();
  const inviteToken = () => pickInviteToken(searchParams.invite);

  // A resend re-issues the link, so it has to carry the invite token too —
  // otherwise resending strands the invitee back on the onboarding form.
  const verifyCallbackUrl = () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    return `${origin}${inviteCallbackUrl(inviteToken(), '/onboarding')}`;
  };

  const handleResend = async (email: string) => {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: verifyCallbackUrl(),
    });
    if (error) {
      throw new Error(error.message || 'Failed to send verification email. Please try again.');
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-6">
      <div class="flex w-full max-w-110 animate-[fade-in-up_0.5s_ease-out] flex-col items-center">
        <BrandMark />
        <header class="mb-2 w-full text-center">
          <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">Check your email</h1>
          <p class="text-base text-muted-foreground">
            We've sent a verification link to <span class="font-medium text-foreground">{getInitialEmail() || 'your email'}</span>.
            Click the link to verify your account, or resend below.
          </p>
        </header>
        <ResendVerificationForm
          onSubmit={handleResend}
          initialEmail={getInitialEmail()}
          redirectTo={withInvite('/login', inviteToken())}
          redirectLabel="Back to login"
        />
      </div>
      <Footer links={FOOTER_LINKS} />
    </main>
  );
};
