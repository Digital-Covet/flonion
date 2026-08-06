import {
  createSignal,
  onCleanup,
  Switch,
  Match,
  type Component,
} from 'solid-js';
import { Field } from '@ark-ui/solid/field';
import { PasswordInput } from '@ark-ui/solid/password-input';
import Sparkles from 'lucide-solid/icons/sparkles';
import LoaderCircleIcon from 'lucide-solid/icons/loader-circle';
import Check from 'lucide-solid/icons/check';
import EyeIcon from 'lucide-solid/icons/eye';
import EyeOffIcon from 'lucide-solid/icons/eye-off';
import type { FormStatus, SignUpFormProps } from '@/types/auth-ui';

const PASSWORD_MIN_LENGTH = 8;

type PasswordStrength = 0 | 1 | 2 | 3 | 4;

const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; color: string; bg: string }
> = {
  0: { label: '', color: 'bg-border', bg: 'bg-border' },
  1: { label: 'Weak', color: 'bg-red-500', bg: 'bg-red-500' },
  2: { label: 'Fair', color: 'bg-orange-500', bg: 'bg-orange-500' },
  3: { label: 'Good', color: 'bg-yellow-500', bg: 'bg-yellow-500' },
  4: { label: 'Strong', color: 'bg-green-500', bg: 'bg-green-500' },
};

function evaluatePasswordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as PasswordStrength;
}

function hasMinLength(pw: string): boolean {
  return pw.length >= PASSWORD_MIN_LENGTH;
}

function hasUpperCase(pw: string): boolean {
  return /[A-Z]/.test(pw);
}

function hasNumber(pw: string): boolean {
  return /\d/.test(pw);
}

function hasSymbol(pw: string): boolean {
  return /[^A-Za-z0-9]/.test(pw);
}

const Requirement: Component<{ met: boolean; label: string }> = (props) => (
  <li
    class={`flex items-center gap-1.5 text-xs transition-colors ${props.met ? 'text-green-600' : 'text-muted-foreground'
      }`}
  >
    <Check class={`h-3 w-3 ${props.met ? 'opacity-100' : 'opacity-30'}`} />
    <span>{props.label}</span>
  </li>
);

export const SignUpForm: Component<SignUpFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>('idle');
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [touchedFields, setTouchedFields] = createSignal<Set<string>>(
    new Set(),
  );

  onCleanup(() => {});

  const isInteractive = () => status() === 'idle';
  const strength = () => evaluatePasswordStrength(password());

  const markTouched = (field: string) => {
    setTouchedFields((prev) => new Set([...prev, field]));
  };

  const isTouched = (field: string) => touchedFields().has(field);

  const nameError = (): string | null => {
    if (!isTouched('name')) return null;
    const trimmed = name().trim();
    if (!trimmed) return 'Name is required';
    return null;
  };

  const emailError = (): string | null => {
    if (!isTouched('email')) return null;
    const trimmed = email().trim();
    if (!trimmed) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Invalid email address';
    return null;
  };

  const passwordError = (): string | null => {
    if (!isTouched('password')) return null;
    if (password().length === 0) return 'Password is required';
    return null;
  };

  const fieldState = (field: string, hasError: boolean | null): string => {
    if (hasError === null) return '';
    if (hasError) return 'border-red-500 focus:ring-red-500/20';
    if (isTouched(field)) return 'border-green-500 focus:ring-green-500/20';
    return '';
  };

  const validate = (): string | null => {
    const trimmedName = name().trim();
    if (!trimmedName) return 'Name is required';

    if (!email().trim()) return 'Email is required';

    if (password().length < PASSWORD_MIN_LENGTH)
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;

    if (!hasUpperCase(password()))
      return 'Password must contain at least one uppercase letter';

    if (!hasNumber(password()))
      return 'Password must contain at least one number';

    if (!hasSymbol(password()))
      return 'Password must contain at least one symbol (@#&!)';

    return null;
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setTouchedFields(new Set(['name', 'email', 'password']));
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus('loading');

    try {
      await props.onSubmit?.(email(), password(), name().trim());
    } catch (e: any) {
      setError(e?.message ?? 'Sign up failed. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <div class="w-full">
      <form class="w-full space-y-4" onSubmit={handleSubmit}>
        <Field.Root invalid={!!nameError()}>
          <Field.Label class="mb-1.5 block text-sm font-medium text-foreground">
            Name <span class="text-muted-foreground">*</span>
          </Field.Label>
          <Field.Input
            type="text"
            required
            placeholder="e.g. Jane Cooper"
            value={name()}
            autocomplete="name"
            disabled={!isInteractive()}
            onInput={(event) => setName(event.currentTarget.value)}
            onBlur={() => markTouched('name')}
            class={`w-full rounded-full border border-input bg-card px-6 py-4 text-base text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${fieldState(
              'name',
              !!nameError(),
            )}`}
          />
          {nameError() && (
            <Field.ErrorText class="mt-1.5 text-sm text-red-600">
              {nameError()}
            </Field.ErrorText>
          )}
        </Field.Root>

        <Field.Root invalid={!!emailError()}>
          <Field.Label class="mb-1.5 block text-sm font-medium text-foreground">
            Email address <span class="text-muted-foreground">*</span>
          </Field.Label>
          <Field.Input
            type="email"
            required
            placeholder="e.g. jane@example.com"
            value={email()}
            autocomplete="email"
            disabled={!isInteractive()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            onBlur={() => markTouched('email')}
            class={`w-full rounded-full border border-input bg-card px-6 py-4 text-base text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${fieldState(
              'email',
              !!emailError(),
            )}`}
          />
          {emailError() && (
            <Field.ErrorText class="mt-1.5 text-sm text-red-600">
              {emailError()}
            </Field.ErrorText>
          )}
        </Field.Root>

        <Field.Root invalid={!!passwordError()}>
          <PasswordInput.Root>
            <Field.Label class="mb-1.5 block text-sm font-medium text-foreground">
              Password <span class="text-muted-foreground">*</span>
            </Field.Label>
            <PasswordInput.Control class={`flex w-full items-center rounded-full border border-input bg-card px-6 py-4 transition-colors focus-within:ring-2 focus-within:ring-primary/20 disabled:opacity-60 ${fieldState(
              'password',
              !!passwordError(),
            )}`}>
              <PasswordInput.Input
                required
                placeholder="Create a password"
                autocomplete="new-password"
                disabled={!isInteractive()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                onBlur={() => markTouched('password')}
                class="w-full bg-transparent text-base text-foreground outline-none disabled:opacity-60"
              />
              <PasswordInput.VisibilityTrigger disabled={!isInteractive()} class="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                <PasswordInput.Indicator fallback={<EyeOffIcon class="h-4 w-4" />}>
                  <EyeIcon class="h-4 w-4" />
                </PasswordInput.Indicator>
              </PasswordInput.VisibilityTrigger>
            </PasswordInput.Control>
          </PasswordInput.Root>

          <ul class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <Requirement met={hasMinLength(password())} label="8+ characters" />
            <Requirement met={hasUpperCase(password())} label="One uppercase" />
            <Requirement met={hasNumber(password())} label="One number" />
            <Requirement met={hasSymbol(password())} label="One symbol (@#&!)" />
          </ul>

          {password().length > 0 && (
            <div class="mt-2">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-xs text-muted-foreground">Strength</span>
                <span
                  class={`text-xs font-medium ${strength() <= 1
                      ? 'text-red-600'
                      : strength() === 2
                        ? 'text-orange-600'
                        : strength() === 3
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`}
                >
                  {STRENGTH_CONFIG[strength()].label}
                </span>
              </div>
              <div class="h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  class={`h-full transition-all duration-300 ${STRENGTH_CONFIG[strength()].bg}`}
                  style={{ width: `${(strength() / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {passwordError() && (
            <Field.ErrorText class="mt-1.5 text-sm text-red-600">
              {passwordError()}
            </Field.ErrorText>
          )}
        </Field.Root>

        {error() && (
          <p class="text-center text-sm font-medium text-red-600">{error()}</p>
        )}

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === 'loading'}
          aria-live="polite"
          class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch fallback={<span>{props.submitLabel ?? 'Create account'}</span>}>
            <Match when={status() === 'loading'}>
              <LoaderCircleIcon class="h-5 w-5 animate-spin" />
              <span>Creating account...</span>
            </Match>
            <Match when={status() === 'idle'}>
              <Sparkles class="h-4 w-4" />
              <span>{props.submitLabel ?? 'Create account'}</span>
            </Match>
          </Switch>
        </button>
      </form>

      <p class="mt-6 text-center text-base text-muted-foreground">
        {props.redirectText ?? 'Already have an account?'}{' '}
        <a
          href={props.redirectTo ?? '#'}
          class="font-semibold text-foreground transition-colors hover:text-primary"
        >
          {props.redirectLabel ?? 'Sign in'}
        </a>
      </p>
    </div>
  );
};
