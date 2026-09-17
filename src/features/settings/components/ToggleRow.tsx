import { Show } from "solid-js";
import type { ToggleRowProps } from "../types";

export function ToggleRow(props: ToggleRowProps) {
  return (
    <div class="flex min-h-11 items-start justify-between gap-4 border-b border-muted p-4 last:border-0">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <p class="text-sm leading-5 font-medium">{props.label}</p>
          <Show when={props.badgeIcon} keyed>
            {(BadgeIcon) => (
              <BadgeIcon size={16} class="text-primary" aria-hidden="true" />
            )}
          </Show>
        </div>
        <p class="text-xs leading-4 text-muted-foreground">
          {props.description}
        </p>
      </div>
      {/* The switch rides level with the label line (native settings-list
        pattern): label is text-sm/leading-5 (20px), switch is h-7 (28px), so
        -mt-1 (-4px) puts both vertical centers at 10px. This holds even when
        the description wraps — centering on the whole block would let the
        switch drift away from the label it controls. The ::before expands
        the hit area to ≥44px (DS §2) without shifting layout. */}
      <button
        type="button"
        role="switch"
        id={props.id}
        aria-checked={props.checked}
        aria-label={props.label}
        onClick={() => props.onChange(!props.checked)}
        class={`relative -mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-opacity duration-[180ms] before:absolute before:-inset-3 before:content-[""] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
          props.checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          aria-hidden="true"
          class={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform duration-[180ms] motion-reduce:transition-none ${
            props.checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
