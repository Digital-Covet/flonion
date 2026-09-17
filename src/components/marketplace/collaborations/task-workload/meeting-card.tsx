import { DoorOpen, Video } from "lucide-solid";
import { Show } from "solid-js";
import type { TeamMeeting } from "~/stores/task-store";

interface MeetingCardProps {
  meeting: TeamMeeting;
}

/**
 * Flonion DS §6: team meeting card — 12px radius, tabular time,
 * icon + label for location, 44px Join target.
 */
export default function MeetingCard(props: MeetingCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div class="min-h-12 rounded-card border border-border bg-card p-4 transition-colors duration-150 motion-reduce:transition-none hover:border-control hover:shadow-sm">
      <div class="mb-2 flex items-start justify-between gap-2">
        <span class="tnum inline-flex items-center rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
          {props.meeting.startTime} – {props.meeting.endTime}
        </span>
        <span class="tnum shrink-0 text-xs text-muted-foreground">
          {formatDate(props.meeting.date)}
        </span>
      </div>
      <h4 class="line-clamp-1 font-heading text-base font-medium text-foreground">
        {props.meeting.title}
      </h4>
      <Show
        when={props.meeting.meetUri}
        fallback={
          <p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <DoorOpen size={14} class="shrink-0" aria-hidden="true" />
            {props.meeting.location}
          </p>
        }
      >
        <a
          href={props.meeting.meetUri}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Video size={14} class="shrink-0" aria-hidden="true" />
          Join Google Meet
        </a>
      </Show>
    </div>
  );
}
