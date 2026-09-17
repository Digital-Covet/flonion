import { For } from "solid-js";
import type { AvatarGroupProps } from "~/types";

function AvatarGroup(props: AvatarGroupProps) {
  return (
    <div
      class="flex -space-x-2"
      role="img"
      aria-label={`${props.participants.length} participant${props.participants.length > 1 ? "s" : ""}`}
    >
      <For each={props.participants.slice(0, 3)}>
        {(initials, index) => (
          <div
            aria-hidden="true"
            class={`grid size-8 place-items-center rounded-full border-2 border-card text-xs font-medium ${
              index() % 2
                ? "bg-purple-muted text-purple"
                : "bg-info-muted text-info-text"
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
