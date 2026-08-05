import {
  createSignal,
  onCleanup,
  Switch,
  Match,
  type Component,
} from 'solid-js';
import { Field } from '@ark-ui/solid/field';
import LogIn from 'lucide-solid/icons/log-in';
import LoaderCircleIcon from 'lucide-solid/icons/loader-circle';
import Check from 'lucide-solid/icons/check';
import type { FormStatus, SignInFormProps } from '@/types/auth-ui';

const SUBMISSION_DELAY_MS = 1200;
const SUCCESS_RESET_DELAY_MS = 2000;

export const SignInForm: Component<SignInFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>('idle');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  const isInteractive = () => status() === 'idle';

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, SUBMISSION_DELAY_MS),
      );
      await props.onSubmit?.(email(), password());
      setStatus('success');
      successTimer = setTimeout(() => {
        setStatus('idle');
        setEmail('');
        setPassword('');
      }, SUCCESS_RESET_DELAY_MS);
    } catch (e: any) {
      const message = e?.message ?? 'Sign in failed. Please try again.';
      setErrorMessage(message);
      props.onError?.(message);
      setStatus('idle');
    }
  };

  return (
    <div class="w-full">
      <form class="w-full space-y-4" onSubmit={handleSubmit}>
        <Field.Root>
          <Field.Label class="mb-1.5 block text-sm font-medium text-foreground">
            Email address
          </Field.Label>
          <Field.Input
            type="email"
            required
            placeholder="e.g. jane@example.com"
            value={email()}
            autocomplete="email"
            disabled={!isInteractive()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="w-full rounded-full border border-input bg-card px-6 py-4 text-base text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label class="mb-1.5 block text-sm font-medium text-foreground">
            Password
          </Field.Label>
          <Field.Input
            type="password"
            required
            placeholder="Enter your password"
            value={password()}
            autocomplete="current-password"
            disabled={!isInteractive()}
            onInput={(event) => setPassword(event.currentTarget.value)}
            class="w-full rounded-full border border-input bg-card px-6 py-4 text-base text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </Field.Root>

        {errorMessage() && (
          <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <p class="font-medium">{errorMessage()}</p>
            {errorMessage()?.includes('not verified') && (
              <a
                href={`/verify-email?email=${encodeURIComponent(email())}`}
                class="mt-1 inline-block font-semibold underline transition-colors hover:text-red-900 dark:hover:text-red-200"
              >
                Resend verification email
              </a>
            )}
          </div>
        )}

        <div class="flex justify-end">
          <a
            href={props.forgotPasswordHref ?? '/forgot-password'}
            class="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === 'loading'}
          aria-live="polite"
          class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch fallback={<span>{props.submitLabel ?? 'Sign in'}</span>}>
            <Match when={status() === 'loading'}>
              <LoaderCircleIcon class="h-5 w-5 animate-spin" />
              <span>Signing in...</span>
            </Match>
            <Match when={status() === 'success'}>
              <Check class="h-5 w-5" />
              <span>Success!</span>
            </Match>
            <Match when={status() === 'idle'}>
              <LogIn class="h-4 w-4" />
              <span>{props.submitLabel ?? 'Sign in'}</span>
            </Match>
          </Switch>
        </button>
      </form>

      <p class="mt-6 text-center text-base text-muted-foreground">
        {props.redirectText ?? "Don't have an account?"}{' '}
        <a
          href={props.redirectTo ?? '/signup'}
          class="font-semibold text-foreground transition-colors hover:text-primary"
        >
          {props.redirectLabel ?? 'Sign up'}
        </a>
      </p>
    </div>
  );
};
