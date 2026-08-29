import { SegmentGroup } from "@ark-ui/solid/segment-group";
import type { SegmentControlProps } from "~/types";

function SegmentControl<T extends string>(props: SegmentControlProps<T>) {
  return (
    <SegmentGroup.Root
      value={props.value}
      onValueChange={(details) => props.onChange(details.value as T)}
      class="flex items-center rounded-lg bg-muted p-1"
    >
      <SegmentGroup.Indicator class="rounded-md bg-card shadow-sm" />
      {props.options.map((option) => (
        <SegmentGroup.Item
          value={option.value}
          class={`${props.compact ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} rounded-md font-medium whitespace-nowrap transition-all data-[state=unselected]:text-muted-foreground data-[state=unselected]:hover:text-foreground`}
        >
          <SegmentGroup.ItemText>{option.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemControl />
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}

export default SegmentControl;
