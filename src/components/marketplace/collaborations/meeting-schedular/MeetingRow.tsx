import { Building2, Clock3, Users } from "lucide-solid";
import { Dynamic } from "solid-js/web";
import type { MeetingRowProps } from "~/types";
import AvatarGroup from "./AvatarGroup";
import StatusBadge from "./StatusBadge";

/**
 * Flonion DS §6: 48px rows, tabular times, icon + word + colour badges.
 * Stacks on mobile (list-only below `lg`), side-by-side on desktop.
 * The whole row is a 44px+ target with a 2px primary focus ring.
 */
function MeetingRow(props: MeetingRowProps) {
  const LocationIcon = props.meeting.locationIcon;
  const isPartner = () => props.meeting.category === "partner";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${props.meeting.title}, ${props.meeting.time}`}
      class="e1-enter group flex min-h-12 cursor-pointer flex-col gap-3 rounded-card border border-transparent p-3 transition-colors duration-150 motion-reduce:transition-none hover:border-border hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between sm:p-4"
      style={{ "animation-delay": `${Math.min(props.delay, 280)}ms` }}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick?.();
        }
      }}
    >
      <div class="flex min-w-0 items-center gap-4">
        <div
          aria-hidden="true"
          class={`grid size-12 shrink-0 place-items-center rounded-card ${
            isPartner()
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-muted text-foreground"
          }`}
        >
          <span class="-mb-1.5 text-xs font-medium tracking-wide uppercase opacity-80">
            {props.meeting.month}
          </span>
          <span class="tnum font-heading text-lg leading-none font-semibold">
            {props.meeting.day}
          </span>
        </div>
        <div class="min-w-0">
          <h4 class="truncate font-heading text-base font-medium text-foreground transition-colors group-hover:text-primary">
            {props.meeting.title}
          </h4>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span class="tnum flex items-center gap-1">
              <Clock3 class="size-3.5" aria-hidden="true" />
              {props.meeting.time}
            </span>
            <span class="flex items-center gap-1">
              <Dynamic component={LocationIcon} class="size-3.5" />
              {props.meeting.location}
            </span>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 pl-16 sm:pl-0">
        <AvatarGroup participants={props.meeting.participants} />
        <StatusBadge tone={isPartner() ? "primary" : "purple"}>
          {isPartner() ? (
            <span class="inline-flex items-center gap-1">
              <Building2 class="size-3.5" aria-hidden="true" />
              Partner
            </span>
          ) : (
            <span class="inline-flex items-center gap-1">
              <Users class="size-3.5" aria-hidden="true" />
              Team
            </span>
          )}
        </StatusBadge>
        <StatusBadge
          tone={
            props.meeting.status === "Confirmed"
              ? "primary"
              : props.meeting.status === "Pending"
                ? "orange"
                : "destructive"
          }
        >
          {props.meeting.status}
        </StatusBadge>
      </div>
    </div>
  );
}

export default MeetingRow;
