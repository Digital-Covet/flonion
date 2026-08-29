import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { GlassCard } from "./glass-card";

interface StatTileProps {
  value: string;
  label: string;
  children?: JSX.Element;
}

export const StatTile = (props: StatTileProps) => (
  <GlassCard class="flex flex-col items-center justify-center text-center p-4">
    <span class="font-heading text-2xl font-bold text-foreground">
      {props.value}
    </span>
    <Show when={props.children}>
      <div class="mt-1 mb-1">{props.children}</div>
    </Show>
    <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">
      {props.label}
    </span>
  </GlassCard>
);
