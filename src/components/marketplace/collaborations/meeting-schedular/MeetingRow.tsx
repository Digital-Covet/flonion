import { Dynamic } from "solid-js/web";
import { Clock3, MoreHorizontal } from "lucide-solid";
import type { Component } from "solid-js";
import type { MeetingRowProps } from "~/types";
import AvatarGroup from "./AvatarGroup";
import StatusBadge from "./StatusBadge";

function MeetingRow(props: MeetingRowProps) {
  const LocationIcon = props.meeting.locationIcon;

  return (
    <article
      class="list-enter group flex flex-col gap-4 rounded-lg border border-transparent p-3 transition-all hover:border-border hover:bg-background sm:flex-row sm:items-center sm:justify-between"
      style={{ "animation-delay": `${props.delay}ms` }}
    >
      <div class="flex min-w-0 items-center gap-4">
        <div
          class={`grid size-12 shrink-0 place-items-center rounded-lg ${
            props.meeting.category === "partner"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-muted text-foreground"
          }`}
        >
          <span class="-mb-2 text-[10px] font-semibold uppercase opacity-80">{props.meeting.month}</span>
          <span class="font-heading text-lg font-semibold leading-none">{props.meeting.day}</span>
        </div>
        <div class="min-w-0">
          <h4 class="truncate text-base text-foreground transition-colors group-hover:text-primary">
            {props.meeting.title}
          </h4>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-1">
              <Clock3 class="size-3.5" />
              {props.meeting.time}
            </span>
            <span class="flex items-center gap-1">
              <Dynamic component={LocationIcon} class="size-3.5" />
              {props.meeting.location}
            </span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 pl-16 sm:pl-0">
        <AvatarGroup participants={props.meeting.participants} />
        <StatusBadge tone={props.meeting.category === "partner" ? "primary" : "purple"}>
          {props.meeting.category}
        </StatusBadge>
        <StatusBadge tone={props.meeting.status === "Confirmed" ? "primary" : "orange"}>
          {props.meeting.status}
        </StatusBadge>
        <button
          type="button"
          aria-label={`More options for ${props.meeting.title}`}
          class="ml-auto text-muted-foreground opacity-70 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreHorizontal class="size-5" />
        </button>
      </div>
    </article>
  );
}

export default MeetingRow;
