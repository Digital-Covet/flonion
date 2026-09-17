import { Progress } from "@ark-ui/solid/progress";
import type { LoadBarProps } from "~/types";

/**
 * Flonion DS §6: load overview as bars WITH numbers — tabular numerals,
 * text labels, never colour alone. `detail` already carries "3 meetings"
 * style text from the API.
 */
function LoadBar(props: LoadBarProps) {
  const isBusy = () => props.tone === "orange";
  return (
    <div>
      <div class="tnum mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium">
        <span class="text-foreground">{props.label}</span>
        <span class={isBusy() ? "text-warning" : "text-success"}>
          {props.detail}
        </span>
      </div>
      <Progress.Root
        value={props.value}
        min={0}
        max={100}
        aria-label={`${props.label}: ${props.detail}`}
        class="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <Progress.Track class="h-full w-full">
          <Progress.Range
            class={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
              isBusy() ? "bg-warning" : "bg-success"
            }`}
          />
        </Progress.Track>
      </Progress.Root>
    </div>
  );
}

export default LoadBar;
