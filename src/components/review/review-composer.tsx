import Check from "lucide-solid/icons/check";
import Link2 from "lucide-solid/icons/link-2";
import MapPin from "lucide-solid/icons/map-pin";
import Phone from "lucide-solid/icons/phone";
import Send from "lucide-solid/icons/send";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import { For, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import type { Rating, ReviewDraft, ReviewSuggestion } from "@/features/reviews/review-types";
import { SuggestionCard } from "~/components/review/suggestion-card";

interface ReviewComposerActions {
  setRating: (rating: Rating) => void;
  setText: (text: string) => void;
  fetchSuggestions: () => void;
  shareReview?: () => void;
  submitReview: () => void;
  applySuggestion?: (suggestion: ReviewSuggestion) => void;
  dismissSuggestion?: (suggestionId: string) => void;
}

interface ReviewComposerProps {
  draft: ReviewDraft;
  actions: ReviewComposerActions;
  logo?: string | null;
  businessName?: string;
  phone?: string;
  address?: string;
  hideBusinessInfo?: boolean;
  heading?: string;
  submitLabel?: string;
  aiButtonLabel?: string;
  placeholder?: string;
  ratingLabel?: string;
  showShareButton?: boolean;
  ratingHint?: string;
  aiLoading?: boolean;
  cooldown?: boolean;
  suggestions?: ReviewSuggestion[];
  showSuggestions?: boolean;
  showTrustStatement?: boolean;
}

const ratings: Rating[] = [1, 2, 3, 4, 5];
const MAX_CHARS = 500;

export function ReviewComposer(props: ReviewComposerProps) {
  const characterCount = () => props.draft.text.length;

  const isTextEmpty = () => props.draft.text.trim().length === 0;
  const isSubmitDisabled = () => props.draft.rating === 0 || isTextEmpty();

  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    props.actions.setText(target.value);
  };

  return (
    <section
      aria-labelledby="draft-review-heading"
      class="h-full rounded-xl border border-border bg-card p-5 shadow-md"
    >
      <Show when={!props.hideBusinessInfo}>
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
      </Show>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="draft-review-heading" class="text-lg font-semibold text-foreground">
          {props.heading ?? "Your Review"}
        </h2>

        <Show when={props.showShareButton && props.actions.shareReview}>
          <button
            type="button"
            onClick={props.actions.shareReview}
            class="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Link2 class="size-4" aria-hidden="true" />
            Copy Review Link
          </button>
        </Show>
      </div>

      <fieldset class="mt-6">
        <legend class="text-sm font-medium text-foreground">{props.ratingLabel ?? "Rating"}</legend>
        <div class="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Review rating">
          <For each={ratings}>
            {(rating) => {
              const selected = () => rating <= props.draft.rating && props.draft.rating > 0;

              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  aria-label={`${rating} out of 5 stars`}
                  onClick={() => props.actions.setRating(rating as Rating)}
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
            {props.draft.rating > 0 ? `${props.draft.rating}/5` : "Select a rating"}
          </span>
        </div>
        <Show when={props.ratingHint}>
          <p class="mt-1.5 text-xs text-muted-foreground italic">{props.ratingHint}</p>
        </Show>
      </fieldset>

      <Field.Root class="mt-5">
        <Field.Label class="text-sm font-medium text-foreground">
          Tell us about your experience
        </Field.Label>

        <div class="relative mt-2">
          <Field.Textarea
            id="review-text"
            onInput={handleInput}
            placeholder={props.placeholder ?? "What did you like? What could we improve?"}
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

      <Show when={props.showSuggestions && props.suggestions && props.suggestions.length > 0}>
        <div class="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 text-primary" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-foreground">AI Suggestions</h3>
            <Show when={props.aiLoading}>
              <span class="ml-auto text-xs text-muted-foreground animate-pulse">
                Thinking...
              </span>
            </Show>
          </div>

          <div class="mt-3 space-y-3">
            <For each={props.suggestions!}>
              {(suggestion, index) => (
                <SuggestionCard
                  suggestion={suggestion}
                  onApply={(s) => props.actions.applySuggestion?.(s)}
                  onDismiss={(id) => props.actions.dismissSuggestion?.(id)}
                  style={`animation-delay: ${index() * 80}ms`}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={props.showSuggestions && props.suggestions && props.suggestions.length === 0 && !props.aiLoading}>
        <div class="mt-4 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-5 text-center">
          <Sparkles class="mx-auto mb-2 size-4 text-muted-foreground/40" aria-hidden="true" />
          <p class="text-sm text-muted-foreground">
            AI can polish your wording while keeping your experience and meaning intact.
          </p>
        </div>
      </Show>

      <div class="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={props.actions.fetchSuggestions}
          disabled={props.aiLoading || props.cooldown || isTextEmpty()}
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Sparkles class="size-4" aria-hidden="true" />
          {props.aiLoading ? "Thinking..." : props.cooldown ? "Wait..." : (props.aiButtonLabel ?? "Improve with AI")}
        </button>

        <button
          type="button"
          onClick={props.actions.submitReview}
          disabled={isSubmitDisabled()}
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Send class="size-4" aria-hidden="true" />
          {props.submitLabel ?? "Submit Review"}
        </button>
      </div>

      <Show when={props.showTrustStatement}>
        <p class="mt-3 text-center text-xs text-muted-foreground/60">
          You'll review your feedback before it's posted.
        </p>
      </Show>

      <p class="sr-only">
        Improve with AI sends your draft to an AI service and returns improved review
        suggestions in different tones.
      </p>

      <Check class="sr-only" aria-hidden="true" />
    </section>
  );
}
