import { Field } from "@ark-ui/solid/field";
import Search from "lucide-solid/icons/search";
import { type Component, createSignal, Show } from "solid-js";

export interface FoundBusiness {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  sector: string | null;
  address: string | null;
}

interface JoinTeamStepProps {
  /** Sends the request. Resolves to an error string, or null on success. */
  onRequest: (
    businessId: string,
    message: string,
    confirmDeleteOwnedBusiness: boolean,
  ) => Promise<
    | { ok: true }
    | { ok: false; error: string; requiresConfirmation?: false }
    | { ok: false; requiresConfirmation: true; ownedBusinessName: string }
  >;
  onBack: () => void;
}

const MAX_MESSAGE_LENGTH = 300;

const fieldInputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

export const JoinTeamStep: Component<JoinTeamStepProps> = (props) => {
  const [handle, setHandle] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [found, setFound] = createSignal<FoundBusiness | null>(null);
  const [searching, setSearching] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [confirmDelete, setConfirmDelete] = createSignal("");

  const handleSearch = async (e: Event) => {
    e.preventDefault();
    const value = handle().trim().replace(/^@/, "");

    if (!value) {
      setError("Enter your team's handle or exact business name");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");
    setFound(null);

    try {
      const res = await fetch(
        `/api/team/find-business?handle=${encodeURIComponent(value)}`,
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Couldn't look that up. Please try again.");
        return;
      }

      if (data.ambiguous) {
        setNotice(
          "More than one business goes by that name. Ask your team for their @handle.",
        );
        return;
      }

      if (!data.business) {
        setNotice(
          "No team found with that handle. Check the spelling, or ask your team to send you an invite instead.",
        );
        return;
      }

      setFound(data.business);
    } catch {
      setError("Couldn't look that up. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const submit = async (confirmed: boolean) => {
    const business = found();
    if (!business) return;

    setSending(true);
    setError("");

    try {
      const result = await props.onRequest(
        business.id,
        message().trim(),
        confirmed,
      );

      if (result.ok) return;

      if (result.requiresConfirmation) {
        setConfirmDelete(result.ownedBusinessName);
        return;
      }

      setError(result.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <form onSubmit={handleSearch} class="flex flex-col gap-2">
        <Field.Root>
          <Field.Label class="text-sm font-medium text-foreground">
            Team handle
          </Field.Label>
          <div class="mt-1.5 flex gap-2">
            <Field.Input
              value={handle()}
              onInput={(e) => setHandle(e.currentTarget.value)}
              placeholder="@acme"
              autocomplete="off"
              class={fieldInputClass}
            />
            <button
              type="submit"
              disabled={searching()}
              class="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Search size={16} aria-hidden="true" />
              {searching() ? "Finding..." : "Find"}
            </button>
          </div>
        </Field.Root>
        <p class="text-xs text-muted-foreground">
          Ask whoever set up your team for their handle. You can also type the
          business name exactly as it's registered.
        </p>
      </form>

      <Show when={notice()}>
        <p class="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {notice()}
        </p>
      </Show>

      <Show when={error()}>
        <p role="alert" class="text-sm text-destructive">
          {error()}
        </p>
      </Show>

      <Show when={found()}>
        {(business) => (
          <div class="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
            <div class="flex items-center gap-3">
              <Show
                when={business().logo}
                fallback={
                  <div class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-base font-medium text-muted-foreground">
                    {business().name.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={business().logo ?? ""}
                  alt=""
                  class="size-11 shrink-0 rounded-lg object-cover"
                />
              </Show>
              <div class="min-w-0">
                <p class="truncate font-medium text-foreground">
                  {business().name}
                </p>
                <p class="truncate text-sm text-muted-foreground">
                  {business().username ? `@${business().username}` : null}
                  {business().username && business().sector ? " · " : null}
                  {business().sector}
                </p>
              </div>
            </div>

            <Show when={!confirmDelete()}>
              <Field.Root>
                <Field.Label class="text-sm font-medium text-foreground">
                  Add a note{" "}
                  <span class="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Field.Label>
                <Field.Textarea
                  value={message()}
                  onInput={(e) => setMessage(e.currentTarget.value)}
                  maxlength={MAX_MESSAGE_LENGTH}
                  rows={3}
                  placeholder="Hi, I'm the new designer — Priya asked me to join."
                  class={`mt-1.5 resize-none ${fieldInputClass}`}
                />
                <p class="mt-1 text-right text-xs text-muted-foreground">
                  {message().length}/{MAX_MESSAGE_LENGTH}
                </p>
              </Field.Root>

              <button
                type="button"
                onClick={() => submit(false)}
                disabled={sending()}
                class="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {sending() ? "Sending..." : "Request to join"}
              </button>

              <p class="text-xs text-muted-foreground">
                An owner or admin has to approve you before you get access.
              </p>
            </Show>

            {/* The server refuses until this is acknowledged, so the trade is
                always named before anything is deleted. */}
            <Show when={confirmDelete()}>
              <div class="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
                <p class="text-sm text-muted-foreground">
                  You can only belong to one business.{" "}
                  <span class="font-medium text-foreground">
                    {confirmDelete()}
                  </span>{" "}
                  is empty — nothing has been added to it — so joining{" "}
                  {business().name} will permanently delete it. This can't be
                  undone.
                </p>
                <div class="flex gap-3">
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={sending()}
                    class="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {sending() ? "Sending..." : "Delete and request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete("")}
                    disabled={sending()}
                    class="rounded-lg bg-muted px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                  >
                    Go back
                  </button>
                </div>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <button
        type="button"
        onClick={props.onBack}
        class="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Back
      </button>
    </div>
  );
};
