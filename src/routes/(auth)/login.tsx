import { BrandMark, SignInForm, Footer, IllustrationPanel } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';
import { useSearchParams } from '@solidjs/router';
import { inviteCallbackUrl, pickInviteToken, withInvite } from '~/lib/invite-redirect';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

const ILLUSTRATION_IMAGE_URL = '/auth-image.webp';

export default function LoginPage() {
  // An invited user arrives here mid-flow; the token has to survive the sign-in.
  const [searchParams] = useSearchParams();
  const inviteToken = () => pickInviteToken(searchParams.invite);

  const handleEmailSubmit = async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: inviteCallbackUrl(inviteToken(), '/dashboard'),
    });
    if (error) {
      const status = (error as any).status;
      if (status === 403) {
        throw new Error('Email is not verified. Please verify your email before signing in.');
      }
      throw new Error(error.message || 'Sign in failed. Please try again.');
    }
  };

  return (
    <main class="flex min-h-dvh flex-col bg-background md:flex-row">
      <IllustrationPanel
        imageSrc={ILLUSTRATION_IMAGE_URL}
        imageAlt="Mobile application context illustration"
      />

      <section class="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 md:py-6">
        <div class="flex w-full max-w-110 animate-[fade-in-up_0.5s_ease-out] flex-col items-center">
          <BrandMark />
          <header class="mb-1 w-full text-center">
            <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">Welcome back</h1>
            <p class="text-base text-muted-foreground">
              Sign in to your account
            </p>
          </header>
          <SignInForm
            onSubmit={handleEmailSubmit}
            redirectTo={withInvite('/signup', inviteToken())}
            redirectLabel="Sign up"
          />
        </div>
        <Footer links={FOOTER_LINKS} />
      </section>
    </main>
  );
};
