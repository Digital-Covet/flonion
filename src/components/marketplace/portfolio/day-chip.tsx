import { cn } from "~/lib/cn";

interface DayChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export const DayChip = (props: DayChipProps) => (
  <button
    type="button"
    onClick={props.onClick}
    class={cn(
      "flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      props.active
        ? "bg-primary text-primary-foreground"
        : "bg-card text-foreground border border-border hover:bg-muted"
    )}
  >
    {props.label}
  </button>
);
