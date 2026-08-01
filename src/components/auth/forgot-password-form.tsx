import {
  createSignal,
  onCleanup,
  Switch,
  Match,
  type Component,
} from 'solid-js';
import { Field } from '@ark-ui/solid/field';
import Send from 'lucide-solid/icons/send';
import LoaderCircleIcon from 'lucide-solid/icons/loader-circle';
import Check from 'lucide-solid/icons/check';
import type { FormStatus, ForgotPasswordFormProps } from '@/types/auth-ui';

const SUBMISSION_DELAY_MS = 1200;

export const ForgotPasswordForm: Component<ForgotPasswordFormProps> = (props) => {
  const [status, setStatus] = createSignal<FormStatus>('idle');
  const [email, setEmail] = createSignal('');

  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  const isInteractive = () => status() === 'idle';

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isInteractive()) return;

    setStatus('loading');

    try {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, SUBMISSION_DELAY_MS),
      );
      await props.onSubmit?.(email());
      setStatus('success');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div class="w-full">
      <form class="w-full space-y-4" onSubmit={handleSubmit}>
        <Field.Root>
          <Field.Label class="sr-only">Email address</Field.Label>
          <Field.Input
            type="email"
            required
            placeholder="Enter your email"
            value={email()}
            autocomplete="email"
            disabled={!isInteractive()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="w-full rounded-full border border-input bg-card px-6 py-4 text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </Field.Root>

        <button
          type="submit"
          disabled={!isInteractive()}
          aria-busy={status() === 'loading'}
          aria-live="polite"
          class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Switch fallback={<span>{props.submitLabel ?? 'Send reset link'}</span>}>
            <Match when={status() === 'loading'}>
              <LoaderCircleIcon class="h-5 w-5 animate-spin" />
              <span>Sending...</span>
            </Match>
            <Match when={status() === 'success'}>
              <Check class="h-5 w-5" />
              <span>Check your email</span>
            </Match>
            <Match when={status() === 'idle'}>
              <Send class="h-4 w-4" />
              <span>{props.submitLabel ?? 'Send reset link'}</span>
            </Match>
          </Switch>
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        {props.redirectText ?? 'Remember your password?'}{' '}
        <a
          href={props.redirectTo ?? '/login'}
          class="border-b border-foreground font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {props.redirectLabel ?? 'Back to login'}
        </a>
      </p>
    </div>
  );
};
