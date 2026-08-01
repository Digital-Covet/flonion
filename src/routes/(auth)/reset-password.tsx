import { BrandMark, ResetPasswordForm, Footer } from '@/components/auth';
import { FooterLink } from '~/types/auth-ui';
import { authClient } from '@/lib/auth-client';
import { useLocation } from '@solidjs/router';

const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Help', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
] as const;

export default function ResetPasswordPage() {
  const location = useLocation();
  const token = () => location.query.token as string | undefined;

  const handlePasswordSubmit = async (newPassword: string) => {
    const currentToken = token();
    if (!currentToken) {
      console.error('[ResetPasswordPage] No token found in URL');
      return;
    }

    const { error } = await authClient.resetPassword({
      newPassword,
      token: currentToken,
    });
    if (error) {
      console.error('[ResetPasswordPage] Reset failed:', error.message);
    }
  };

  return (
    <main class="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-6">
      <div class="flex w-full max-w-110 animate-[fade-in-up_0.5s_ease-out] flex-col items-center">
        <BrandMark />
        <header class="mb-2 w-full text-center">
          <h1 class="mb-2 font-heading text-2xl text-foreground md:text-3xl">Set new password</h1>
          <p class="text-base text-muted-foreground">
            Enter your new password below
          </p>
        </header>
        <ResetPasswordForm onSubmit={handlePasswordSubmit} />
      </div>
      <Footer links={FOOTER_LINKS} />
    </main>
  );
};
