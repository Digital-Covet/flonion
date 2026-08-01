import { BrandMark, SignInForm, Footer, IllustrationPanel } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

const ILLUSTRATION_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAMIdvyeuaL52iY56flILB5uJc2g5I3ygiHxhnqGoPNFpfccRNuvixaMqp-TCeA-uJoPnYTisRTUAwqeN7t11NXlu5XyKwCEI6k3YmptcB8jiNkKX6UrNMvVp28kgssCi-_2b4AZC--G1DBcZ-mgRGmdfveU-FUyIZsQksfx9W_qNDfcheeCV87m0FKjgh5hr-qz9P12vrohsfo5qxqPo4rqQYXAnUFNWteGQAzNLrK8Sja5FhYZvJYkZrNs9kQIwRqUHk';

export default function LoginPage() {
  const handleEmailSubmit = async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    });
    if (error) {
      console.error('[LoginPage] Sign in failed:', error.message);
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
          <SignInForm onSubmit={handleEmailSubmit} redirectTo="/signup" redirectLabel="Sign up" />
        </div>
        <Footer links={FOOTER_LINKS} />
      </section>
    </main>
  );
};
