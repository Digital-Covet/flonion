import { Show } from "solid-js";
import type { ToggleRowProps } from "../types";

export function ToggleRow(props: ToggleRowProps) {
  return (
    <div class="flex items-center justify-between border-b border-muted p-4 last:border-0">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1">
          <p class="text-sm leading-5 font-bold">{props.label}</p>
          <Show when={props.badgeIcon} keyed>
            {(BadgeIcon) => <BadgeIcon size={16} class="text-primary" />}
          </Show>
        </div>
        <p class="text-xs leading-4 text-muted-foreground">
          {props.description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        id={props.id}
        aria-checked={props.checked}
        aria-label={props.label}
        onClick={() => props.onChange(!props.checked)}
        class={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          props.checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          aria-hidden="true"
          class={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            props.checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
