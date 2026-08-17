import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Title } from "@solidjs/meta";
import { Select, createListCollection } from "@ark-ui/solid/select";
import { Field } from "@ark-ui/solid/field";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import MessageSquare from "lucide-solid/icons/message-square";
import Send from "lucide-solid/icons/send";
import CheckCircle from "lucide-solid/icons/check-circle";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Star from "lucide-solid/icons/star";
import { authClient } from "~/lib/auth-client";
import { SectionCard } from "~/features/settings/components/SectionCard";
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
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal("");

  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const user = session()?.data?.user;
    if (user) {
      if (user.name && !name()) setName(user.name);
      if (user.email && !email()) setEmail(user.email);
    }
  });

  createEffect(() => {
    if (success()) {
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => setSuccess(false), 4000);
    }
  });

  onCleanup(() => clearTimeout(dismissTimer));

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="flex-1 overflow-y-auto px-6 py-8">
      <Title>Feedback — Flonion</Title>
      <div class="mx-auto max-w-4xl space-y-8">
        <div class="mb-8">
          <h2 class="text-2xl font-semibold leading-10 tracking-tight text-foreground">
            Send Feedback
          </h2>
          <p class="mt-1 text-lg leading-6 text-muted-foreground">
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
                class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                <Select.Trigger class="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <Select.ValueText
                    placeholder="Select a category"
                    class={category() ? "text-foreground" : "text-muted-foreground"}
                  />
                  <ChevronDown
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Select.Trigger>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content class="z-50 mt-1 max-h-64 min-w-52 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-sm">
                    <For each={categoryItems}>
                      {(item) => (
                        <Select.Item
                          item={item}
                          class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-foreground outline-none data-highlighted:bg-muted"
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
              <div class="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Feedback rating">
                <For each={[1, 2, 3, 4, 5]}>
                  {(star) => {
                    const selected = () => star <= rating() && rating() > 0;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected()}
                        aria-label={`${star} out of 5 stars`}
                        onClick={() => setRating(star)}
                        class={`inline-flex size-9 items-center justify-center rounded-md transition-colors ${
                          selected()
                            ? "text-primary"
                            : "text-slate-300 hover:bg-muted hover:text-primary"
                        }`}
                      >
                        <Star
                          class="size-6 text-yellow-400"
                          fill={selected() ? "#fcc800" : "none"}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  }}
                </For>
                <span class="ml-1.5 text-sm font-medium text-muted-foreground">
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
                autoresize
                class="w-full resize-none overflow-hidden rounded-lg border border-border bg-card px-4 py-3 text-sm leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span class="mt-1 block text-right text-xs text-muted-foreground">
                {message().length}/2000
              </span>
            </Field.Root>
          </div>
        </SectionCard>

        <div class="flex justify-end gap-4 pt-6">
          <button
            type="button"
            onClick={resetForm}
            class="h-10 rounded-lg border border-border px-6 text-sm font-medium leading-normal text-muted-foreground transition-colors hover:bg-muted"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid() || submitting()}
            class="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium leading-normal text-primary-foreground shadow-md transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:scale-95 disabled:opacity-70"
          >
            <Send size={16} />
            {submitting() ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {success()
          ? "Feedback submitted successfully"
          : error()
            ? `Error: ${error()}`
            : ""}
      </div>

      <Show when={success()}>
        <div class="fixed top-4 right-4 z-30 max-w-sm animate-[fade-in-up_0.2s_ease-out]">
          <div class="flex items-start gap-3 rounded-xl border border-positive/20 bg-positive-muted px-4 py-3 text-sm text-foreground shadow-md">
            <CheckCircle
              class="mt-0.5 size-4 shrink-0 text-positive"
              aria-hidden="true"
            />
            <p class="flex-1">
              Thank you! Your feedback has been submitted successfully.
            </p>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="fixed top-4 right-4 z-30 max-w-sm animate-[fade-in-up_0.2s_ease-out]">
          <div class="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive-muted px-4 py-3 text-sm text-foreground shadow-md">
            <AlertTriangle
              class="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <p class="flex-1">{error()}</p>
          </div>
        </div>
      </Show>
    </main>
  );
}
