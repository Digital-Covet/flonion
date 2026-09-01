import { Video, DoorOpen } from "lucide-solid";
import { Show } from "solid-js";
import type { TeamMeeting } from "~/stores/task-store";

interface MeetingCardProps {
  meeting: TeamMeeting;
}

export default function MeetingCard(props: MeetingCardProps) {
  const formatTime = (time: string) => {
    return time;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div class="border border-border rounded-lg p-4 hover:border-primary transition-colors hover:shadow-sm bg-card">
      <div class="flex justify-between items-start mb-2">
        <span class="bg-purple-muted text-purple text-xs font-medium px-2 py-1 rounded">
          {formatTime(props.meeting.startTime)} - {formatTime(props.meeting.endTime)}
        </span>
        <span class="text-xs text-muted-foreground">
          {formatDate(props.meeting.date)}
        </span>
      </div>
      <h4 class="text-base font-medium text-foreground mb-1 line-clamp-1">
        {props.meeting.title}
      </h4>
      <Show
        when={props.meeting.meetUri}
        fallback={
          <p class="text-sm font-sans text-muted-foreground flex items-center gap-1">
            <DoorOpen size={14} />
            {props.meeting.location}
          </p>
        }
      >
        <a
          href={props.meeting.meetUri}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-sans text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <Video size={14} />
          Join Google Meet
        </a>
      </Show>
    </div>
  );
}
