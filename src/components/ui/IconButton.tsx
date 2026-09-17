import { Tooltip } from "@ark-ui/solid";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { IconComponent } from "../../types";

interface IconButtonProps {
  icon: IconComponent;
  label: string;
}

/**
 * Phase 1 primitive — spec §2 touch targets: app-scope icon buttons minimum
 * 36px with 44px hit-slop on mobile; E1 180ms; focus ring Primary #5B21B6
 * (2px + 2px offset, DS §2).
 */
const IconButton: Component<IconButtonProps> = (props) => {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        class="relative inline-flex min-h-9 min-w-9 items-center justify-center rounded-full p-2 text-muted-foreground transition-opacity duration-180 ease-out hover:bg-muted hover:text-foreground motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary after:absolute after:-inset-2 after:content-[''] sm:after:hidden"
        aria-label={props.label}
      >
        <Dynamic component={props.icon} size={24} />
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content class="bg-foreground text-background px-2 py-1 rounded-control text-xs font-medium z-50 shadow-lg">
          {props.label}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
};

export default IconButton;
