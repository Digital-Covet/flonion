import { cn } from "~/lib/cn";

interface TimeSlotProps {
  time: string;
  state?: "selected" | "available" | "disabled";
  onClick?: () => void;
}

const styles: Record<string, string> = {
  selected: "border-primary text-primary bg-positive-muted",
  disabled:
    "border-border text-muted-foreground/50 cursor-not-allowed opacity-50",
  available: "border-border text-foreground hover:bg-muted",
};

export const TimeSlot = (props: TimeSlotProps) => (
  <button
    type="button"
    onClick={props.state === "disabled" ? undefined : props.onClick}
    disabled={props.state === "disabled"}
    class={cn(
      "py-2 rounded-md border text-sm font-medium transition-colors",
      styles[props.state ?? "available"]
    )}
  >
    {props.time}
  </button>
);
