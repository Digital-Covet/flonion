import {
  createSignal,
  onCleanup,
  Show,
  Switch,
  Match,
  type Component,
} from 'solid-js';
import { Field } from '@ark-ui/solid/field';
import KeyRound from 'lucide-solid/icons/key-round';
import LoaderCircleIcon from 'lucide-solid/icons/loader-circle';
import Check from 'lucide-solid/icons/check';
import type { FormStatus, ResetPasswordFormProps } from '@/types/auth-ui';

const SUBMISSION_DELAY_MS = 1200;
const SUCCESS_REDIRECT_DELAY_MS = 2000;

export const ResetPasswordForm: Component<ResetPasswordFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>('idle');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');

  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  const isInteractive = () => status() === 'idle';

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    if (newPassword() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    setStatus('loading');

    try {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, SUBMISSION_DELAY_MS),
      );
      await props.onSubmit?.(newPassword());
      setStatus('success');
      successTimer = setTimeout(() => {
        window.location.href = '/login';
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div class="w-full">
      <form class="w-full space-y-4" onSubmit={handleSubmit}>
        <Field.Root>
          <Field.Label class="sr-only">New password</Field.Label>
          <Field.Input
            type="password"
            required
            placeholder="Enter new password"
            value={newPassword()}
            autocomplete="new-password"
            disabled={!isInteractive()}
            onInput={(event) => {
              setNewPassword(event.currentTarget.value);
              setError('');
            }}
            class="w-full rounded-full border border-input bg-card px-6 py-4 text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label class="sr-only">Confirm password</Field.Label>
          <Field.Input
            type="password"
            required
            placeholder="Confirm new password"
            value={confirmPassword()}
            autocomplete="new-password"
            disabled={!isInteractive()}
            onInput={(event) => {
              setConfirmPassword(event.currentTarget.value);
              setError('');
            }}
            class="w-full rounded-full border border-input bg-card px-6 py-4 text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </Field.Root>

        <Show when={error()}>
          <p class="text-center text-sm text-destructive">{error()}</p>
        </Show>

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === 'loading'}
          aria-live="polite"
          class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch fallback={<span>{props.submitLabel ?? 'Reset password'}</span>}>
            <Match when={status() === 'loading'}>
              <LoaderCircleIcon class="h-5 w-5 animate-spin" />
              <span>Resetting...</span>
            </Match>
            <Match when={status() === 'success'}>
              <Check class="h-5 w-5" />
              <span>Password reset!</span>
            </Match>
            <Match when={status() === 'idle'}>
              <KeyRound class="h-4 w-4" />
              <span>{props.submitLabel ?? 'Reset password'}</span>
            </Match>
          </Switch>
        </button>
      </form>
    </div>
  );
};
