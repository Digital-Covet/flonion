import ArrowUpRight from "lucide-solid/icons/arrow-up-right";
import Check from "lucide-solid/icons/check";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { type Component, createMemo, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cn } from "../../lib/cn";
import type { ActionItemData, ActionStatus } from "../../types";
import { notify } from "../ui/toast";

interface ActionItemProps {
  item: ActionItemData;
  onComplete?: (id: string) => void;
}

/* DS §2: status is icon + words + colour, never colour alone.
   Pending is the default state and carries no badge — only
   high-priority and completed are labelled, keeping title rows clean. */
const STATUS_CONFIG: Record<
  ActionStatus,
  { containerClass: string; iconTile: string; titleClass: string }
> = {
  pending: {
    containerClass: "border-border bg-card",
    iconTile: "bg-muted text-muted-foreground",
    titleClass: "text-foreground",
  },
  completed: {
    containerClass: "border-border bg-muted/40",
    iconTile: "bg-success-muted text-success",
    titleClass: "text-muted-foreground line-through",
  },
  "high-priority": {
    containerClass: "border-warning/40 bg-card",
    iconTile: "bg-warning-muted text-warning",
    titleClass: "text-foreground",
  },
};

const IMPACT_DOT: Record<string, string> = {
  "High impact": "bg-warning",
  "Medium impact": "bg-primary",
  "Low impact": "bg-control",
};

const ActionItemCard: Component<ActionItemProps> = (props) => {
  const config = createMemo(() => STATUS_CONFIG[props.item.status]);
  const done = () => props.item.status === "completed";
  const urgent = () => props.item.status === "high-priority";
  const href = () => props.item.href ?? "/settings";

  const handleAction = () => {
    if (done()) return;
    // Optimistic complete → parent moves the row + toast confirms.
    // Real save happens on the settings page the deep link opens.
    props.onComplete?.(props.item.id);
    notify("success", "Marked as done", props.item.title);
  };

  return (
    <li
      class={cn(
        "flex flex-col gap-3 rounded-card border p-5 shadow-sm transition-opacity duration-180 motion-reduce:transition-none sm:flex-row sm:items-center sm:gap-4",
        config().containerClass,
      )}
    >
      <span
        class={cn(
          "grid size-11 shrink-0 place-items-center self-start rounded-control sm:self-center",
          config().iconTile,
        )}
      >
        <Dynamic component={props.item.icon} size={20} aria-hidden="true" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 class={cn("font-heading text-lg font-medium", config().titleClass)}>
            {props.item.title}
          </h3>
          <Show when={urgent()}>
            <span class="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-warning">
              <TriangleAlert size={12} aria-hidden="true" />
              High priority
            </span>
          </Show>
        </div>
        <p class="mt-0.5 text-sm text-muted-foreground">
          {props.item.description}
        </p>
        <Show when={props.item.impact && !done()}>
          <p class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class={cn(
                "size-1.5 rounded-full",
                IMPACT_DOT[props.item.impact!] ?? "bg-control",
              )}
              aria-hidden="true"
            />
            {props.item.impact}
          </p>
        </Show>
      </div>

      <Show
        when={!done()}
        fallback={
          <span class="inline-flex h-11 shrink-0 items-center gap-1.5 self-start rounded-control border border-border bg-muted px-4 text-sm font-medium text-muted-foreground sm:self-center">
            <Check size={16} aria-hidden="true" />
            {props.item.actionLabel}
          </span>
        }
      >
        <a
          href={href()}
          onClick={handleAction}
          class={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-control px-4 text-sm font-medium transition-opacity duration-180 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:self-center",
            urgent()
              ? "bg-primary text-primary-foreground hover:bg-primary-hover"
              : "border border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {props.item.actionLabel}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </Show>
    </li>
  );
};

export default ActionItemCard;
