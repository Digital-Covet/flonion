import { Field } from "@ark-ui/solid/field";
import type { LucideIcon } from "lucide-solid";
import ArrowRight from "lucide-solid/icons/arrow-right";
import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { notify } from "~/components/ui/toast";
import { SectionCard } from "~/features/settings/components/SectionCard";
import { authClient } from "~/lib/auth-client";

interface ChangeEmailCardProps {
  icon: LucideIcon;
}

export function ChangeEmailCard(props: ChangeEmailCardProps) {
  const session = authClient.useSession();

  const [newEmail, setNewEmail] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal("");

  const user = () => session()?.data?.user;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const email = newEmail().trim();

    if (!email) {
      setError("Please enter a new email address.");
      return;
    }

    if (email === user()?.email) {
      setError("New email must be different from current email.");
      return;
    }

    setLoading(true);
    try {
      // NOTE: /change-email accepts only {newEmail, callbackURL} — the
      // session itself is the re-auth. No password is collected or sent.
      const { error: changeError } = await authClient.changeEmail({
        newEmail: email,
        callbackURL: "/account",
      });

      if (changeError) {
        const msg =
          changeError.message || "Failed to change email. Please try again.";
        setError(msg);
        notify("error", msg);
        return;
      }

      setSuccess(true);
      setNewEmail("");
      notify("success", "Verification email sent");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      notify("error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Change Email Address" icon={props.icon}>
      <p class="mb-4 text-sm text-muted-foreground">
        Update the email address associated with your account. A verification
        link will be sent to your new email address.
      </p>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field.Root>
            <Field.Label
              for="current-email"
              class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
            >
              Current Email
            </Field.Label>
            <Field.Input
              id="current-email"
              type="email"
              value={user()?.email ?? ""}
              disabled
              class="min-h-11 w-full rounded-control border border-border bg-muted px-4 text-base leading-6 text-muted-foreground"
            />
          </Field.Root>

          <Field.Root invalid={!!error()}>
            <Field.Label
              for="new-email"
              class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
            >
              New Email Address
            </Field.Label>
            <Field.Input
              id="new-email"
              type="email"
              value={newEmail()}
              onInput={(e) => setNewEmail((e.target as HTMLInputElement).value)}
              placeholder="new@example.com"
              class="min-h-11 w-full rounded-control border border-border bg-card px-4 text-base leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Show when={error()}>
              <Field.ErrorText class="mt-1.5 block text-sm text-destructive">
                {error()}
              </Field.ErrorText>
            </Show>
          </Field.Root>
        </div>

        <Show when={success()}>
          <p role="status" class="text-sm text-success">
            Verification email sent! Please check your new email address to
            confirm the change.
          </p>
        </Show>

        <div class="flex justify-end pt-2">
          <Button type="submit" loading={loading()} loadingLabel="Sending…">
            Update Email
            <Show when={!loading()}>
              <ArrowRight size={16} aria-hidden="true" />
            </Show>
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
