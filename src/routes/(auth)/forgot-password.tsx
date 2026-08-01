import { BrandMark, ForgotPasswordForm, Footer } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

const RESET_REDIRECT_URL = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/reset-password`;

export default function ForgotPasswordPage() {
  const handleEmailSubmit = async (email: string) => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: RESET_REDIRECT_URL,
    });
    if (error) {
      console.error('[ForgotPasswordPage] Request failed:', error.message);
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-6">
      <div class="flex w-full max-w-110 animate-[fade-in-up_0.5s_ease-out] flex-col items-center">
        <BrandMark />
        <header class="mb-2 w-full text-center">
          <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">Reset your password</h1>
          <p class="text-base text-muted-foreground">
            Enter your email and we'll send you a reset link
          </p>
        </header>
        <ForgotPasswordForm onSubmit={handleEmailSubmit} redirectTo="/login" redirectLabel="Back to login" />
      </div>
      <Footer links={FOOTER_LINKS} />
    </main>
  );
};
