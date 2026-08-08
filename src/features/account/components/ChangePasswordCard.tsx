import { createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import type { LucideIcon } from "lucide-solid";
import { authClient } from "~/lib/auth-client";
import { SectionCard } from "~/features/settings/components/SectionCard";

interface ChangePasswordCardProps {
  icon: LucideIcon;
}

export function ChangePasswordCard(props: ChangePasswordCardProps) {
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal("");

  const passwordsMismatch = () =>
    confirmPassword() !== "" && confirmPassword() !== newPassword();

  const passwordStrength = () => {
    const pwd = newPassword();
    if (!pwd) return { level: 0, label: "", color: "" };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, label: "Weak", color: "bg-destructive" };
    if (score <= 4) return { level: 2, label: "Fair", color: "bg-yellow-500" };
    return { level: 3, label: "Strong", color: "bg-green-500" };
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const current = currentPassword();
    const newPwd = newPassword();
    const confirm = confirmPassword();

    if (!current) {
      setError("Please enter your current password.");
      return;
    }

    if (!newPwd) {
      setError("Please enter a new password.");
      return;
    }

    if (newPwd.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPwd !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    if (newPwd === current) {
      setError("New password must be different from current password.");
      return;
    }

    setLoading(true);
    try {
      const { error: changeError } = await authClient.changePassword({
        currentPassword: current,
        newPassword: newPwd,
        revokeOtherSessions: false,
      });

      if (changeError) {
        setError(changeError.message || "Failed to change password. Please try again.");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Change Password" icon={props.icon}>
      <p class="mb-4 text-sm text-muted-foreground">
        Update your password to keep your account secure. Choose a strong
        password that you haven't used elsewhere.
      </p>

      <form onSubmit={handleSubmit} class="space-y-4">
        <Field.Root>
          <Field.Label
            for="current-password"
            class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
          >
            Current Password
          </Field.Label>
          <Field.Input
            id="current-password"
            type="password"
            value={currentPassword()}
            onInput={(e) =>
              setCurrentPassword((e.target as HTMLInputElement).value)
            }
            placeholder="Enter your current password"
            class="h-10 w-full max-w-md rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label
            for="new-password"
            class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
          >
            New Password
          </Field.Label>
          <Field.Input
            id="new-password"
            type="password"
            value={newPassword()}
            onInput={(e) =>
              setNewPassword((e.target as HTMLInputElement).value)
            }
            placeholder="Enter your new password"
            class="h-10 w-full max-w-md rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Show when={newPassword()}>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  class={`h-full transition-all ${passwordStrength().color}`}
                  style={{ width: `${(passwordStrength().level / 3) * 100}%` }}
                />
              </div>
              <span class="text-xs text-muted-foreground">
                {passwordStrength().label}
              </span>
            </div>
          </Show>
        </Field.Root>

        <Field.Root invalid={passwordsMismatch()}>
          <Field.Label
            for="confirm-password"
            class="mb-1.5 block text-sm leading-5 font-medium text-muted-foreground"
          >
            Confirm New Password
          </Field.Label>
          <Field.Input
            id="confirm-password"
            type="password"
            value={confirmPassword()}
            onInput={(e) =>
              setConfirmPassword((e.target as HTMLInputElement).value)
            }
            placeholder="Confirm your new password"
            class="h-10 w-full max-w-md rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Show when={passwordsMismatch()}>
            <Field.ErrorText class="mt-1.5 block text-xs text-destructive">
              Passwords do not match
            </Field.ErrorText>
          </Show>
        </Field.Root>

        <Show when={error()}>
          <p class="text-sm text-destructive">{error()}</p>
        </Show>

        <Show when={success()}>
          <p class="text-sm text-green-600">Password changed successfully.</p>
        </Show>

        <div class="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading()}
            class="h-10 rounded-lg bg-primary px-6 text-sm font-medium leading-normal text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:scale-95 disabled:opacity-70"
          >
            {loading() ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
