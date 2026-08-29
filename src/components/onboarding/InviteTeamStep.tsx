import { createSignal, For, Show, type Component } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import ArrowRight from "lucide-solid/icons/arrow-right";
import Trash2 from "lucide-solid/icons/trash-2";
import UserPlus from "lucide-solid/icons/user-plus";
import { ROLE_DEFINITIONS, type UserRole } from "~/lib/roles";

export interface TeamInvite {
  email: string;
  role: UserRole;
}

interface InviteTeamStepProps {
  invites: TeamInvite[];
  onAddInvite: (invite: TeamInvite) => void;
  onRemoveInvite: (email: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

const fieldInputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

const selectClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/10";

export const InviteTeamStep: Component<InviteTeamStepProps> = (props) => {
  const [email, setEmail] = createSignal("");
  const [role, setRole] = createSignal<UserRole>("member");
  const [error, setError] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const emailValue = email().trim().toLowerCase();

    if (!emailValue) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setError("Invalid email format");
      return;
    }

    if (props.invites.some((i) => i.email === emailValue)) {
      setError("This email is already added");
      return;
    }

    props.onAddInvite({ email: emailValue, role: role() });
    setEmail("");
    setRole("member");
    setError("");
  };

  return (
    <div class="flex flex-col gap-6">
      <div>
        <h3 class="text-lg font-semibold text-foreground mb-2">
          Invite Your Team
        </h3>
        <p class="text-sm text-muted-foreground">
          Add team members to collaborate with you. You can also do this later from Settings.
        </p>
      </div>

      <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div class="flex gap-3">
          <Field.Root class="flex-1">
            <Field.Label for="invite-email" class="text-sm font-semibold text-foreground">
              Email Address
            </Field.Label>
            <Field.Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                setError("");
              }}
              class={fieldInputClass}
            />
            <Show when={error()}>
              <Field.ErrorText class="text-xs text-destructive mt-1">
                {error()}
              </Field.ErrorText>
            </Show>
          </Field.Root>

          <Field.Root class="w-40">
            <Field.Label for="invite-role" class="text-sm font-semibold text-foreground">
              Role
            </Field.Label>
            <select
              id="invite-role"
              value={role()}
              onChange={(e) => setRole(e.currentTarget.value as UserRole)}
              class={selectClass}
            >
              <For each={ROLE_DEFINITIONS}>
                {(r) => (
                  <option value={r.value}>{r.label}</option>
                )}
              </For>
            </select>
          </Field.Root>
        </div>

        <button
          type="submit"
          class="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          <UserPlus size={16} />
          Add to List
        </button>
      </form>

      <Show when={props.invites.length > 0}>
        <div class="border border-border rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-muted">
              <tr>
                <th class="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th class="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <For each={props.invites}>
                {(invite) => (
                  <tr class="bg-card">
                    <td class="px-4 py-3 text-sm text-foreground">
                      {invite.email}
                    </td>
                    <td class="px-4 py-3 text-sm text-muted-foreground">
                      {ROLE_DEFINITIONS.find((r) => r.value === invite.role)?.label ?? invite.role}
                    </td>
                    <td class="px-4 py-3">
                      <button
                        onClick={() => props.onRemoveInvite(invite.email)}
                        class="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <div class="flex justify-between items-center pt-4 border-t border-border">
        <button
          onClick={props.onSkip}
          class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={props.onContinue}
          class="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
