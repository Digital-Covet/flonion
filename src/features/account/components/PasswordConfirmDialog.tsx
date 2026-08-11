import { createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import X from "lucide-solid/icons/x";
import Lock from "lucide-solid/icons/lock";

interface PasswordConfirmDialogProps {
  title: string;
  description: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
  error: string;
  loading: boolean;
}

export function PasswordConfirmDialog(props: PasswordConfirmDialogProps) {
  const [password, setPassword] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const pwd = password();
    if (pwd) {
      props.onSubmit(pwd);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <div class="relative z-10 mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <button
          type="button"
          onClick={props.onClose}
          class="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div class="mb-4 flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Lock size={20} class="text-primary" />
          </div>
          <div>
            <h3 class="text-lg font-semibold">{props.title}</h3>
            <p class="text-sm text-muted-foreground">{props.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <Field.Root>
            <Field.Label
              for="confirm-password"
              class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
            >
              Enter your password to confirm
            </Field.Label>
            <Field.Input
              id="confirm-password"
              type="password"
              value={password()}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="Enter your password"
              autofocus
              class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field.Root>

          <Show when={props.error}>
            <p class="text-sm text-destructive">{props.error}</p>
          </Show>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              class="h-9 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={props.loading || !password()}
              class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {props.loading ? "Confirming..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
