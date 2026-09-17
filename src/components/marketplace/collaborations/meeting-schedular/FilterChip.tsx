import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { IconComponent } from "~/types";

interface FilterChipProps {
  label: string;
  icon?: IconComponent;
  pressed: boolean;
  onClick: () => void;
  count?: number;
}

/**
 * Flonion DS §6: content filters are chips with icons — never colour
 * alone, never desktop-only segments. 44×44 minimum target, `aria-pressed`,
 * 2px primary focus ring, E1 crossfade only.
 */
export default function FilterChip(props: FilterChipProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      class={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3.5 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        props.pressed
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-control hover:text-foreground"
      }`}
    >
      {props.icon && (
        <Dynamic
          component={props.icon}
          class="size-4 shrink-0"
          aria-hidden="true"
        />
      )}
      {props.label}
      {props.count !== undefined && (
        <span class="tnum rounded-full bg-muted px-1.5 text-xs font-medium">
          {props.count}
        </span>
      )}
    </button>
  );
}
