import Briefcase from "lucide-solid/icons/briefcase";
import Check from "lucide-solid/icons/check";
import Coffee from "lucide-solid/icons/coffee";
import MessageSquare from "lucide-solid/icons/message-square";
import Star from "lucide-solid/icons/star";
import X from "lucide-solid/icons/x";
import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { LucideProps } from "lucide-solid";
import type { ReviewSuggestion, SuggestionTone } from "@/features/reviews/review-types";

interface ToneConfig {
  icon: Component<LucideProps>;
  colorClass: string;
  bgClass: string;
}

const toneConfig: Record<SuggestionTone, ToneConfig> = {
  Simple: {
    icon: MessageSquare,
    colorClass: "text-info",
    bgClass: "bg-info-muted",
  },
  Professional: {
    icon: Briefcase,
    colorClass: "text-purple",
    bgClass: "bg-purple-muted",
  },
  Casual: {
    icon: Coffee,
    colorClass: "text-orange",
    bgClass: "bg-orange-muted",
  },
};

interface SuggestionCardProps {
  suggestion: ReviewSuggestion;
  onApply: (suggestion: ReviewSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  style?: string;
}

export function SuggestionCard(props: SuggestionCardProps) {
  const config = () => toneConfig[props.suggestion.tone];
  const ToneIcon = () => config().icon;

  return (
    <article
      class="rounded-xl border border-border bg-card p-4 shadow-md animate-[fade-in-up_0.3s_ease-out_both]"
      style={props.style}
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span
            class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${config().colorClass} ${config().bgClass}`}
          >
            {(() => {
              const Icon = ToneIcon();
              return <Icon class="size-3.5" aria-hidden="true" />;
            })()}
            {props.suggestion.tone}
          </span>

          <Show when={props.suggestion.recommended}>
            <span class="inline-flex items-center gap-1 rounded-full bg-positive-muted px-2 py-0.5 text-xs font-semibold text-positive">
              <Star class="size-3" aria-hidden="true" fill="currentColor" />
              Recommended
            </span>
          </Show>
        </div>

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
        Use this version
      </button>
    </article>
  );
}
