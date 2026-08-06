import { BrandMark, SignUpForm, Footer, IllustrationPanel } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

const ILLUSTRATION_IMAGE_URL = '/auth-image.webp';

export default function SignUpPage() {
  const handleEmailSubmit = async (email: string, password: string, name: string) => {
    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: '/onboarding',
    });
    if (error) {
      console.error('[SignUpPage] Sign up failed:', error.message);
      throw new Error(error.message);
    }
    window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
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
            <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">Create an account</h1>
            <p class="text-base text-muted-foreground">
              Enter your details to create your account
            </p>
          </header>

          <SignUpForm onSubmit={handleEmailSubmit} redirectTo="/login" redirectLabel="Sign in" />
        </div>

        <Footer links={FOOTER_LINKS} />
      </section>
    </main>
  );
};
