import { Check, Sparkles, X } from "lucide-solid";
import type { ReviewSuggestion } from "@/features/reviews/review-types";

interface SuggestionCardProps {
  suggestion: ReviewSuggestion;
  onApply: (suggestion: ReviewSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  style?: string;
}

export function SuggestionCard(props: SuggestionCardProps) {
  return (
    <article
      class="rounded-lg border border-border bg-card p-4 shadow-sm animate-[fade-in-up_0.3s_ease-out_both]"
      style={props.style}
    >
      <div class="flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles class="size-3.5" aria-hidden="true" />
          {props.suggestion.tone}
        </span>

        <button
          type="button"
          aria-label={`Dismiss ${props.suggestion.tone} suggestion`}
          onClick={() => props.onDismiss(props.suggestion.id)}
          class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <p class="mt-3 text-sm leading-6 text-muted-foreground">
        {props.suggestion.text}
      </p>

      <button
        type="button"
        onClick={() => props.onApply(props.suggestion)}
        class="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <Check class="size-3.5" aria-hidden="true" />
        Apply
      </button>
    </article>
  );
}
