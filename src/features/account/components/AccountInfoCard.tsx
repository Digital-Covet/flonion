import { createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import type { LucideIcon } from "lucide-solid";
import CheckCircle from "lucide-solid/icons/check-circle";
import AlertCircle from "lucide-solid/icons/alert-circle";
import Pencil from "lucide-solid/icons/pencil";
import X from "lucide-solid/icons/x";
import Check from "lucide-solid/icons/check";
import { authClient } from "~/lib/auth-client";

interface AccountInfoCardProps {
  icon: LucideIcon;
}

export function AccountInfoCard(props: AccountInfoCardProps) {
  const session = authClient.useSession();

  const [editing, setEditing] = createSignal(false);
  const [name, setName] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const user = () => session()?.data?.user;
  const isVerified = () => user()?.emailVerified ?? false;

  const startEditing = () => {
    setName(user()?.name ?? "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setName("");
  };

  const saveName = async () => {
    const trimmed = name().trim();
    if (!trimmed || trimmed === user()?.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await authClient.updateUser({ name: trimmed });
      setEditing(false);
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <section class="relative overflow-hidden rounded-xl border border-border bg-card p-6">
      <div class="mb-6 flex items-center gap-4">
        <props.icon size={20} class="text-primary" />
        <h3 class="text-lg leading-7 font-semibold">Account Information</h3>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-muted p-4 last:border-0">
          <div class="flex flex-col gap-1">
            <p class="text-sm leading-5 font-medium text-muted-foreground">
              Display Name
            </p>
            <Show
              when={editing()}
              fallback={
                <div class="flex items-center gap-2">
                  <p class="text-sm font-bold">{user()?.name ?? "Not set"}</p>
                  <button
                    type="button"
                    onClick={startEditing}
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Edit name"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              }
            >
              <div class="flex items-center gap-2">
                <Field.Root class="max-w-xs flex-1">
                  <Field.Input
                    id="display-name"
                    type="text"
                    value={name()}
                    onInput={(e) => setName((e.target as HTMLInputElement).value)}
                    placeholder="Enter your name"
                    class="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field.Root>
                <button
                  type="button"
                  onClick={saveName}
                  disabled={saving()}
                  class="inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  aria-label="Save name"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving()}
                  class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label="Cancel editing"
                >
                  <X size={16} />
                </button>
              </div>
            </Show>
          </div>
        </div>

        <div class="flex items-center justify-between border-b border-muted p-4 last:border-0">
          <div class="flex flex-col gap-1">
            <p class="text-sm leading-5 font-medium text-muted-foreground">
              Email Address
            </p>
            <div class="flex items-center gap-2">
              <p class="text-sm font-bold">{user()?.email}</p>
              <Show
                when={isVerified()}
                fallback={
                  <span class="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    <AlertCircle size={12} />
                    Unverified
                  </span>
                }
              >
                <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle size={12} />
                  Verified
                </span>
              </Show>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between p-4">
          <div class="flex flex-col gap-1">
            <p class="text-sm leading-5 font-medium text-muted-foreground">
              Member Since
            </p>
            <p class="text-sm font-bold">
              {user()?.createdAt
                ? new Date(user()!.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
