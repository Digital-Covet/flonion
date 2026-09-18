import { IconCircleX, IconStar } from "@tabler/icons-solidjs";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { cn } from "~/lib/cn";

export const RATING_LABELS = [
  "Very poor",
  "Poor",
  "Okay",
  "Very good",
  "Excellent",
] as const;

export const ratingText = (n: number) => `${n} of 5 – ${RATING_LABELS[n - 1]}`;

/**
 * Star Rating Selector (spec §4.1). Native radios, so the choice is a real
 * form value and arrow keys move between stars. Never pre-filled on public
 * pages: the visitor always picks the stars.
 */
export function StarRating(props: {
  legend: string;
  value: number;
  onChange: (rating: number) => void;
  /** Replaces the helper line, e.g. when Continue was tapped without a rating. */
  error?: string;
  name?: string;
  ref?: (first: HTMLInputElement) => void;
}) {
  const id = createUniqueId();
  const [hover, setHover] = createSignal(0);
  const stars: HTMLSpanElement[] = [];
  const shown = () => hover() || props.value;

  function select(n: number) {
    props.onChange(n);
    const el = stars[n - 1];
    // Web Animations API instead of a JS motion library: 1 → 1.25 → 1.
    if (
      el?.animate &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], {
        duration: 240,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
    }
  }

  return (
    <fieldset class="flex flex-col items-center gap-2">
      <legend class="mb-2 w-full text-center font-display text-lg font-semibold text-balance text-text">
        {props.legend}
      </legend>
      <div class="flex">
        <For each={[1, 2, 3, 4, 5]}>
          {(n) => (
            <label
              class={cn(
                "grid size-12 cursor-pointer place-items-center rounded-md sm:size-14",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                "animate-in fade-in-0 duration-[var(--duration-fast)] ease-[var(--ease-out)] [animation-fill-mode:backwards] motion-reduce:animate-none",
              )}
              style={{ "animation-delay": `${(n - 1) * 30}ms` }}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
            >
              <input
                ref={(el) => {
                  if (n === 1) props.ref?.(el);
                }}
                type="radio"
                class="sr-only"
                name={props.name ?? `rating-${id}`}
                value={n}
                checked={props.value === n}
                onChange={() => select(n)}
                aria-label={ratingText(n)}
                aria-invalid={props.error ? "true" : undefined}
              />
              <span
                ref={(el) => {
                  stars[n - 1] = el;
                }}
                class="grid place-items-center"
              >
                <IconStar
                  aria-hidden="true"
                  class="size-9 stroke-accent motion-safe:transition-[fill] motion-safe:duration-[var(--duration-fast)]"
                  stroke-width={1.5}
                  fill={n <= shown() ? "var(--star)" : "transparent"}
                />
              </span>
            </label>
          )}
        </For>
      </div>
      <p
        aria-live="polite"
        class={cn(
          "flex min-h-6 items-center gap-1.5 text-sm",
          props.error && !props.value ? "text-error" : "text-text-muted",
        )}
      >
        <Show when={props.error && !props.value}>
          <IconCircleX aria-hidden="true" class="size-4 shrink-0" />
        </Show>
        {props.value
          ? ratingText(props.value)
          : (props.error ?? "Tap a star to rate")}
      </p>
    </fieldset>
  );
}
