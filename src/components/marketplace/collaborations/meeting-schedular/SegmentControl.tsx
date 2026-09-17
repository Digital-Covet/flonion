import { SegmentGroup } from "@ark-ui/solid/segment-group";
import { Index } from "solid-js";
import type { SegmentControlProps } from "~/types";

/**
 * Flonion DS §2 + §4: view switcher (Upcoming / Availability).
 * Ark SegmentGroup with 44px targets, 2px primary focus ring,
 * E1 crossfade only (no layout animation). For content filters
 * (incoming/outgoing, team/partner) use FilterChip instead.
 */
function SegmentControl<T extends string>(props: SegmentControlProps<T>) {
  return (
    <SegmentGroup.Root
      value={props.value}
      onValueChange={(details) => props.onChange(details.value as T)}
      class="flex items-center gap-1 rounded-card border border-border bg-muted p-1"
    >
      <SegmentGroup.Indicator class="rounded-control bg-card shadow-sm" />
      <Index each={props.options}>
        {(option) => (
          <SegmentGroup.Item
            value={option().value}
            class={`min-h-11 rounded-control font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=checked]:text-foreground data-[state=unselected]:text-muted-foreground data-[state=unselected]:hover:text-foreground ${props.compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`}
          >
            <SegmentGroup.ItemText>{option().label}</SegmentGroup.ItemText>
            <SegmentGroup.ItemControl />
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        )}
      </Index>
    </SegmentGroup.Root>
  );
}

export default SegmentControl;
