export type FormStatus = 'idle' | 'loading' | 'success';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  links: readonly FooterLink[];
}

export interface DividerProps {
  label?: string;
  class?: string;
}

export interface SignUpFormProps {
  onSubmit?: (email: string, password: string, name: string) => void | Promise<void>;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}

export interface SignInFormProps {
  onSubmit?: (email: string, password: string) => void | Promise<void>;
  onError?: (message: string) => void;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
  forgotPasswordHref?: string;
}

export interface ForgotPasswordFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}

export interface ResendVerificationFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  initialEmail?: string;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}

export interface ResetPasswordFormProps {
  onSubmit?: (newPassword: string) => void | Promise<void>;
  submitLabel?: string;
}

export interface IllustrationPanelProps {
  imageSrc: string;
  imageAlt?: string;
}
