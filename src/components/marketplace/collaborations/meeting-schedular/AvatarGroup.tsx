import { For } from "solid-js";
import type { Component } from "solid-js";
import type { AvatarGroupProps } from "~/types";

function AvatarGroup(props: AvatarGroupProps) {
  return (
    <div
      class="flex -space-x-2"
      aria-label={`${props.participants.length} participant${props.participants.length > 1 ? "s" : ""}`}
    >
      <For each={props.participants}>
        {(initials, index) => (
          <div
            class={`grid size-8 place-items-center rounded-full border-2 border-card text-[10px] font-semibold ${
              index() % 2 ? "bg-purple-muted text-purple" : "bg-info-muted text-info"
            }`}
          >
            {initials}
          </div>
        )}
      </For>
    </div>
  );
}

export default AvatarGroup;
