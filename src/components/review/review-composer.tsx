import Check from "lucide-solid/icons/check";
import Link2 from "lucide-solid/icons/link-2";
import MapPin from "lucide-solid/icons/map-pin";
import Phone from "lucide-solid/icons/phone";
import Send from "lucide-solid/icons/send";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import { For, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import type { Rating, ReviewDraft } from "@/features/reviews/review-types";

interface ReviewComposerActions {
  setRating: (rating: Rating) => void;
  setText: (text: string) => void;
  fetchSuggestions: () => void;
  shareReview?: () => void;
  submitReview: () => void;
}

interface ReviewComposerProps {
  draft: ReviewDraft;
  actions: ReviewComposerActions;
  logo?: string | null;
  businessName?: string;
  phone?: string;
  address?: string;
  aiLoading?: boolean;
  cooldown?: boolean;
}

const ratings: Rating[] = [1, 2, 3, 4, 5];
const MAX_CHARS = 500;

export function ReviewComposer(props: ReviewComposerProps) {
  const characterCount = () => props.draft.text.length;

  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    props.actions.setText(target.value);
  };

  return (
    <section
      aria-labelledby="draft-review-heading"
      class="rounded-xl border border-border bg-card p-5 shadow-md"
    >
      <div class="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Business Information
        </p>
        <div class="flex items-start gap-3">
          <Show when={props.logo}>
            <img
              src={props.logo!}
              alt="Company logo"
              class="h-10 w-10 shrink-0 rounded object-contain"
            />
          </Show>
          <div class="min-w-0 space-y-1.5">
            <Show when={props.businessName}>
              <p class="text-sm font-medium text-foreground">
                {props.businessName}
              </p>
            </Show>
            <Show when={props.phone}>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone class="size-3.5 shrink-0" aria-hidden="true" />
                <span class="truncate">{props.phone}</span>
              </div>
            </Show>
            <Show when={props.address}>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
                <span class="truncate">{props.address}</span>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="draft-review-heading" class="text-lg font-semibold text-foreground">
          Draft Review
        </h2>

        <Show when={props.actions.shareReview}>
          <button
            type="button"
            onClick={props.actions.shareReview}
            class="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Link2 class="size-4" aria-hidden="true" />
            Share Review
          </button>
        </Show>
      </div>

      <fieldset class="mt-6">
        <legend class="text-sm font-medium text-foreground">Rating</legend>
        <div class="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Review rating">
          <For each={ratings}>
            {(rating) => {
              const selected = () => rating <= props.draft.rating;

              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  aria-label={`${rating} out of 5 stars`}
                  onClick={() => props.actions.setRating(rating)}
                  class={`inline-flex size-9 items-center justify-center rounded-md transition-colors ${selected()
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
            {props.draft.rating}/5
          </span>
        </div>
      </fieldset>

      <Field.Root class="mt-5">
        <Field.Label class="text-sm font-medium text-foreground">
          Review message
        </Field.Label>

        <div class="relative mt-2">
          <Field.Textarea
            id="review-text"
            onInput={handleInput}
            placeholder="Write your review here..."
            autoresize
            class="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-3 pr-20 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span
            class={`pointer-events-none absolute bottom-3 right-3 text-xs ${characterCount() > MAX_CHARS * 0.9
              ? "text-orange font-semibold"
              : "text-muted-foreground"
              }`}
          >
            {characterCount()}/{MAX_CHARS}
          </span>
        </div>
      </Field.Root>

      <div class="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={props.actions.fetchSuggestions}
          disabled={props.aiLoading || props.cooldown}
          class="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles class="size-4" aria-hidden="true" />
          {props.aiLoading ? "Thinking..." : props.cooldown ? "Wait..." : "AI Suggest"}
        </button>

        <button
          type="button"
          onClick={props.actions.submitReview}
          class="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          <Send class="size-4" aria-hidden="true" />
          Send Review
        </button>
      </div>

      <p class="sr-only">
        AI Suggest sends your draft to an AI service and returns improved review
        suggestions in different tones.
      </p>

      <Check class="sr-only" aria-hidden="true" />
    </section>
  );
}
