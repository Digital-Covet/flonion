import { Switch } from "@ark-ui/solid/switch";
import type { Component } from "solid-js";
import type { AvailabilityWindowProps } from "~/types";

function AvailabilityWindow(props: AvailabilityWindowProps) {
  return (
    <div class="rounded-lg border border-border p-3 transition-colors hover:border-primary/40">
      <div class="mb-2 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class={`size-2 rounded-full ${props.active ? "bg-primary" : "bg-border"}`} />
          <h4 class="text-base">{props.title}</h4>
        </div>
        <Switch.Root
          checked={props.active}
          onCheckedChange={props.onToggle}
          label={`Toggle ${props.title}`}
        >
          <Switch.Control class="relative h-5 w-9 rounded-full transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted">
            <Switch.Thumb class="absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left] data-[state=checked]:left-4.5 data-[state=unchecked]:left-0.5" />
          </Switch.Control>
          <Switch.HiddenInput />
        </Switch.Root>
      </div>
      <p class="text-sm text-muted-foreground">{props.schedule}</p>
    </div>
  );
}

export default AvailabilityWindow;
