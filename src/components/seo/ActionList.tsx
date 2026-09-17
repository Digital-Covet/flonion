import ListChecks from "lucide-solid/icons/list-checks";
import PartyPopper from "lucide-solid/icons/party-popper";
import { type Component, createMemo, For, Show } from "solid-js";
import type { ActionItemData, ActionStatus } from "../../types";
import { EmptyState } from "../ui/empty-state";
import ActionItemCard from "./ActionItem";

interface ActionListProps {
  items: ActionItemData[];
  onComplete?: (id: string) => void;
}

// Spec §6: the queue is priority-ordered — high-priority first, then pending,
// completed last. The data file order is editorial, not sorted.
const STATUS_RANK: Record<ActionStatus, number> = {
  "high-priority": 0,
  pending: 1,
  completed: 2,
};

const ActionList: Component<ActionListProps> = (props) => {
  const open = createMemo(() =>
    [...props.items]
      .filter((i) => i.status !== "completed")
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]),
  );
  const done = createMemo(() =>
    props.items.filter((i) => i.status === "completed"),
  );

  return (
    <section aria-labelledby="seo-actions-heading">
      <h2
        id="seo-actions-heading"
        class="mb-4 flex items-center gap-3 font-heading text-2xl font-semibold text-foreground"
      >
        <span class="grid size-10 place-items-center rounded-control bg-positive-muted text-primary">
          <ListChecks size={20} aria-hidden="true" />
        </span>
        Action items
        <span class="tnum rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {open().length} open
        </span>
      </h2>

      <Show
        when={open().length > 0}
        fallback={
          <EmptyState
            icon={PartyPopper}
            title="All caught up"
            description="Every action item is done. Check again next week — scores refresh after Google syncs."
          />
        }
      >
        <ul class="grid gap-3">
          <For each={open()}>
            {(item) => (
              <ActionItemCard item={item} onComplete={props.onComplete} />
            )}
          </For>
        </ul>
      </Show>

      <Show when={open().length > 0 && done().length > 0}>
        <h3 class="mb-2 mt-6 font-heading text-lg font-medium text-muted-foreground">
          Completed ({done().length})
        </h3>
        <ul class="grid gap-3">
          <For each={done()}>{(item) => <ActionItemCard item={item} />}</For>
        </ul>
      </Show>
    </section>
  );
};
export default ActionList;
