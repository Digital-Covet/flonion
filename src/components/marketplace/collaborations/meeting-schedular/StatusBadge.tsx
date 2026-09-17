import { CheckCircle2, Clock3, Users, XCircle } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { BadgeTone, StatusBadgeProps } from "~/types";

/**
 * Flonion DS §2: status is NEVER colour alone — every badge pairs
 * a Lucide icon + word + colour.
 * - primary → Confirmed / partner (primary tint)
 * - orange  → Pending / booked (warning tint)
 * - purple  → team (accent tint)
 * - destructive → Rejected / Cancelled (error tint)
 */
const tones: Record<
  BadgeTone,
  { classes: string; icon: typeof Clock3 | null }
> = {
  primary: {
    classes: "bg-success-muted text-success",
    icon: CheckCircle2,
  },
  orange: {
    classes: "bg-warning-muted text-warning",
    icon: Clock3,
  },
  purple: {
    classes: "bg-purple-muted text-purple",
    icon: Users,
  },
  destructive: {
    classes: "bg-destructive-muted text-destructive",
    icon: XCircle,
  },
};

function StatusBadge(props: StatusBadgeProps) {
  const tone = () => tones[props.tone];
  return (
    <span
      class={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone().classes}`}
    >
      <Show when={tone().icon}>
        {(Icon) => (
          <Dynamic component={Icon()} class="size-3.5" aria-hidden="true" />
        )}
      </Show>
      {props.children}
    </span>
  );
}

export default StatusBadge;
