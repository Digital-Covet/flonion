import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { IconComponent } from "~/types";
import { ButtonLink } from "./button";

/**
 * Phase 1 primitive — spec §6: empty states are NEVER blank charts.
 * Always: illustration/icon + explanation + primary CTA (e.g. sample-data
 * card + "Create your first review link").
 */
export function EmptyState(props: {
  icon?: IconComponent;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  onPrimary?: () => void;
  secondary?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`grid place-items-center gap-2 rounded-card border border-dashed border-border bg-card px-6 py-10 text-center ${props.class ?? ""}`}
    >
      <Show when={props.icon}>
        {(Icon) => (
          <span class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Dynamic component={Icon()} class="size-6" aria-hidden="true" />
          </span>
        )}
      </Show>
      <h3 class="font-heading text-lg font-medium text-foreground">{props.title}</h3>
      <p class="max-w-md text-sm text-muted-foreground">{props.description}</p>
      <Show when={props.primaryLabel && props.primaryHref}>
        <ButtonLink href={props.primaryHref!} size="md" class="mt-2">
          {props.primaryLabel}
        </ButtonLink>
      </Show>
      <Show when={props.primaryLabel && !props.primaryHref && props.onPrimary}>
        <button
          type="button"
          onClick={props.onPrimary}
          class="mt-2 inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-180 hover:bg-primary-hover motion-reduce:transition-none"
        >
          {props.primaryLabel}
        </button>
      </Show>
      <Show when={props.secondary}>{props.secondary}</Show>
    </div>
  );
}
