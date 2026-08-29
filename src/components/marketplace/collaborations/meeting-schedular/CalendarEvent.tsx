import type { CalendarEventProps, CalendarEventTone } from "~/types";

const tones: Record<CalendarEventTone, string> = {
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/25 bg-positive-muted text-primary shadow-sm hover:shadow-md",
  orange: "border-orange/25 bg-orange-muted text-orange shadow-sm hover:shadow-md",
};

function CalendarEvent(props: CalendarEventProps) {
  return (
    <button
      type="button"
      class={`absolute flex flex-col justify-start overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight font-medium transition-shadow ${tones[props.tone ?? "muted"]} ${props.class ?? ""}`}
      style={props.style}
    >
      {props.children}
    </button>
  );
}

export default CalendarEvent;
