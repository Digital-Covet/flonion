import { createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import type { LucideIcon } from "lucide-solid";
import ArrowRight from "lucide-solid/icons/arrow-right";
import { authClient } from "~/lib/auth-client";
import { SectionCard } from "~/features/settings/components/SectionCard";

interface ChangeEmailCardProps {
  icon: LucideIcon;
}

export function ChangeEmailCard(props: ChangeEmailCardProps) {
  const session = authClient.useSession();

  const [newEmail, setNewEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal("");

  const user = () => session()?.data?.user;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const email = newEmail().trim();
    const pwd = password();

    if (!email) {
      setError("Please enter a new email address.");
      return;
    }

    if (email === user()?.email) {
      setError("New email must be different from current email.");
      return;
    }

    if (!pwd) {
      setError("Please enter your current password.");
      return;
    }

    setLoading(true);
    try {
      const { error: changeError } = await authClient.changeEmail({
        newEmail: email,
        callbackURL: "/account",
      });

      if (changeError) {
        setError(changeError.message || "Failed to change email. Please try again.");
        return;
      }

      setSuccess(true);
      setNewEmail("");
      setPassword("");
    } catch {
      setError("An unexpected error occurred. Please try again.");
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
              class="h-10 w-full rounded-lg border border-border bg-muted px-4 text-sm leading-5 text-muted-foreground"
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
              class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Show when={error()}>
              <Field.ErrorText class="mt-1.5 block text-sm text-destructive">
                {error()}
              </Field.ErrorText>
            </Show>
          </Field.Root>
        </div>

        <Field.Root>
          <Field.Label
            for="email-password"
            class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
          >
            Current Password
          </Field.Label>
          <Field.Input
            id="email-password"
            type="password"
            value={password()}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            placeholder="Enter your current password"
            class="h-10 w-full max-w-md rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Field.Root>

        <Show when={success()}>
          <p class="text-sm text-green-600">
            Verification email sent! Please check your new email address to
            confirm the change.
          </p>
        </Show>

        <div class="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading()}
            class="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium leading-normal text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:scale-95 disabled:opacity-70"
          >
            {loading() ? "Sending..." : "Update Email"}
            <Show when={!loading()}>
              <ArrowRight size={16} />
            </Show>
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
