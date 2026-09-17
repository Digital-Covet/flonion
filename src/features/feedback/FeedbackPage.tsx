import { Field } from "@ark-ui/solid/field";
import { createListCollection, Select } from "@ark-ui/solid/select";
import { Title } from "@solidjs/meta";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import MessageSquare from "lucide-solid/icons/message-square";
import Send from "lucide-solid/icons/send";
import Star from "lucide-solid/icons/star";
import { createEffect, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Button, ButtonLink } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { SubmittedCheck } from "~/components/ui/redirect-countdown";
import { notify } from "~/components/ui/toast";
import { SectionCard } from "~/features/settings/components/SectionCard";
import { authClient } from "~/lib/auth-client";
import { FEEDBACK_CATEGORIES } from "./types";

const categoryItems = [...FEEDBACK_CATEGORIES].map((cat) => ({
  label: cat,
  value: cat,
}));

const categoryCollection = createListCollection({ items: categoryItems });

export function FeedbackPage() {
  const session = authClient.useSession();

  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [rating, setRating] = createSignal(0);
  const [message, setMessage] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  // Persistent success receipt (reference ID + summary) — never auto-dismissed.
  const [receipt, setReceipt] = createSignal<{
    id: string;
    category: string;
    rating: number;
  } | null>(null);
  const [error, setError] = createSignal("");
  const [needsLogin, setNeedsLogin] = createSignal(false);

  createEffect(() => {
    const user = session()?.data?.user;
    if (user) {
      if (user.name && !name()) setName(user.name);
      if (user.email && !email()) setEmail(user.email);
    }
  });

  const isFormValid = () =>
    name().trim().length > 0 &&
    email().trim().length > 0 &&
    category() !== "" &&
    rating() >= 1 &&
    rating() <= 5 &&
    message().trim().length > 0;

  const resetForm = () => {
    setName(session()?.data?.user?.name ?? "");
    setEmail(session()?.data?.user?.email ?? "");
    setCategory("");
    setRating(0);
    setMessage("");
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;

    setSubmitting(true);
    setError("");
    setNeedsLogin(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name().trim(),
          email: email().trim(),
          category: category(),
          rating: rating(),
          message: message().trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        // Signed-out submit: input preserved, explicit path back in.
        setNeedsLogin(true);
        setError("Please sign in to send feedback.");
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit feedback");
      }

      setReceipt({
        id: data?.id ?? "received",
        category: category(),
        rating: rating(),
      });
      notify("success", "Feedback submitted");
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      notify("error", "Couldn't submit feedback", "Your input is preserved.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="flex-1 overflow-y-auto px-6 py-8">
      <Title>Feedback — Flonion</Title>
      <div class="mx-auto max-w-4xl space-y-8">
        <div class="mb-8">
          <h1 class="font-heading text-3xl font-semibold text-foreground">
            Send Feedback
          </h1>
          <p class="mt-1 text-base text-muted-foreground">
            Help us improve Flonion. Your feedback is reviewed by our team.
          </p>
        </div>

        <SectionCard title="Your Information" icon={MessageSquare}>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field.Root>
              <Field.Label
                for="feedback-name"
                class="text-sm leading-5 font-medium text-muted-foreground"
              >
                Name
              </Field.Label>
              <Field.Input
                id="feedback-name"
                type="text"
                value={name()}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Your name"
                class="min-h-11 w-full rounded-control border border-border bg-card px-4 text-base leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label
                for="feedback-email"
                class="text-sm leading-5 font-medium text-muted-foreground"
              >
                Email
              </Field.Label>
              <Field.Input
                id="feedback-email"
                type="email"
                value={email()}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="your@email.com"
                class="min-h-11 w-full rounded-control border border-border bg-card px-4 text-base leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field.Root>
          </div>
        </SectionCard>

        <SectionCard title="Feedback Details" icon={Send}>
          <div class="space-y-6">
            <Select.Root
              collection={categoryCollection}
              value={category() ? [category()] : []}
              onValueChange={(details) => setCategory(details.value[0] ?? "")}
              positioning={{ placement: "bottom-start", sameWidth: true }}
            >
              <Select.Label class="text-sm leading-5 font-medium text-muted-foreground">
                Category
              </Select.Label>
              <Select.Control>
                <Select.Trigger class="flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border bg-card px-4 text-base leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <Select.ValueText
                    placeholder="Select a category"
                    class={
                      category() ? "text-foreground" : "text-muted-foreground"
                    }
                  />
                  <ChevronDown
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Select.Trigger>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content class="z-50 mt-1 max-h-64 min-w-52 overflow-y-auto rounded-card border border-border bg-card p-1 shadow-sm">
                    <For each={categoryItems}>
                      {(item) => (
                        <Select.Item
                          item={item}
                          class="flex cursor-pointer items-center justify-between rounded-control px-3 py-2 text-sm text-foreground outline-none data-highlighted:bg-muted"
                        >
                          <Select.ItemText>{item.label}</Select.ItemText>
                          <Select.ItemIndicator>
                            <Check
                              class="size-4 text-primary"
                              aria-hidden="true"
                            />
                          </Select.ItemIndicator>
                        </Select.Item>
                      )}
                    </For>
                  </Select.Content>
                </Select.Positioner>
              </Portal>
              <Select.HiddenSelect />
            </Select.Root>

            <fieldset>
              <legend class="text-sm leading-5 font-medium text-muted-foreground">
                Rating
              </legend>
              <div
                class="mt-2 flex items-center gap-1"
                role="radiogroup"
                aria-label="Feedback rating"
              >
                <For each={[1, 2, 3, 4, 5]}>
                  {(star) => {
                    const selected = () => star <= rating() && rating() > 0;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: the star rating is a button-based radiogroup by design, inside a <fieldset> with role="radiogroup"
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected()}
                        aria-label={`${star} out of 5 stars`}
                        onClick={() => setRating(star)}
                        class={`inline-flex size-9 items-center justify-center rounded-control transition-colors ${
                          selected()
                            ? "text-primary"
                            : "text-border hover:bg-muted hover:text-primary"
                        }`}
                      >
                        <Star
                          class="size-6 text-star"
                          fill={selected() ? "currentColor" : "none"}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  }}
                </For>
                <span class="tnum ml-1.5 text-sm font-medium text-muted-foreground">
                  {rating() > 0 ? `${rating()}/5` : "Select a rating"}
                </span>
              </div>
            </fieldset>

            <Field.Root>
              <Field.Label
                for="feedback-message"
                class="text-sm leading-5 font-medium text-muted-foreground"
              >
                Message
              </Field.Label>
              <Field.Textarea
                id="feedback-message"
                value={message()}
                onInput={(e) =>
                  setMessage((e.target as HTMLTextAreaElement).value)
                }
                placeholder="Tell us what you think, what's broken, or what you'd like to see..."
                maxlength={2000}
                autoresize
                class="w-full resize-none overflow-hidden rounded-control border border-border bg-card px-4 py-3 text-base leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span class="tnum mt-1 block text-right text-xs text-muted-foreground">
                {message().length}/2000
              </span>
            </Field.Root>
          </div>
        </SectionCard>

        <Show when={!receipt()}>
          <div class="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={resetForm}
              class="h-11 rounded-control border border-border px-6 text-sm font-medium leading-normal text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
            >
              Reset
            </button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              loading={submitting()}
              loadingLabel="Submitting…"
            >
              <Send size={16} aria-hidden="true" />
              Submit Feedback
            </Button>
          </div>
        </Show>

        {/* Persistent success receipt — reference ID + summary, no auto-dismiss. */}
        <Show when={receipt()}>
          <div class="e1-enter grid place-items-center gap-3 rounded-card border border-border bg-card px-6 py-10 text-center shadow-sm">
            <SubmittedCheck />
            <h3 class="text-lg font-medium text-foreground">
              Feedback received — thank you
            </h3>
            <p class="max-w-md text-sm text-muted-foreground">
              {receipt()!.category} ·{" "}
              <span class="tnum">{receipt()!.rating}/5</span>. Our team reviews
              every submission. Keep this reference for follow-ups:
            </p>
            <p class="tnum rounded-control bg-muted px-3 py-1.5 font-mono text-sm text-foreground">
              {receipt()!.id}
            </p>
            <div class="flex flex-wrap justify-center gap-2">
              <CopyButton value={() => receipt()?.id ?? ""} size="sm" />
              <button
                type="button"
                onClick={() => setReceipt(null)}
                class="inline-flex h-8 items-center rounded-control border border-border px-3 text-xs font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
              >
                Submit another
              </button>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div
            role="alert"
            class="grid gap-3 rounded-card border border-destructive/25 bg-destructive-muted p-4"
          >
            <p class="text-sm text-destructive">{error()}</p>
            <Show when={needsLogin()}>
              <ButtonLink
                href={`/login?callbackURL=${encodeURIComponent("/feedback")}`}
                size="sm"
                class="w-fit"
              >
                Sign in to continue
              </ButtonLink>
            </Show>
          </div>
        </Show>
      </div>

      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {receipt()
          ? `Feedback submitted successfully, reference ${receipt()!.id}`
          : error()
            ? `Error: ${error()}`
            : ""}
      </div>
    </main>
  );
}
