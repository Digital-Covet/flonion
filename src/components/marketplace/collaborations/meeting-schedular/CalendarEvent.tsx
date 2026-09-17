import type { CalendarEventProps, CalendarEventTone } from "~/types";

const tones: Record<CalendarEventTone, string> = {
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/25 bg-success-muted text-success",
  orange: "border-warning/25 bg-warning-muted text-warning",
};

function CalendarEvent(props: CalendarEventProps) {
  return (
    <button
      type="button"
      class={`absolute flex min-h-6 flex-col justify-start overflow-hidden rounded-control border px-2 py-1 text-left text-xs leading-tight font-medium transition-shadow duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${tones[props.tone ?? "muted"]} ${props.class ?? ""}`}
      style={props.style}
    >
      {props.children}
    </button>
  );
}

export default CalendarEvent;
