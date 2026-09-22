import { Menu } from "@ark-ui/solid/menu";
import {
  IconArrowsSort,
  IconCheck,
  IconFilter,
  IconLayoutList,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { TeamMember } from "~/components/app/context";
import { focusRing } from "~/components/auth/AuthShell";
import { btnPrimary, SelectField } from "~/components/onboarding/ui";
import {
  activeFilterCount,
  assigneeOptions,
  DUE_OPTIONS,
  type DueFilter,
  filtersActive,
  GROUP_OPTIONS,
  type GroupKey,
  PRIORITY_FILTER_OPTIONS,
  type PriorityFilter,
  SORT_OPTIONS,
  type SortKey,
  type TasksView,
} from "~/components/tasks/data";
import { cn } from "~/lib/cn";

/**
 * The list toolbar shared by the table and the kanban: new task, search,
 * filters, and — for the table — sort and grouping. Everything it changes
 * lives in the URL, so a filtered view is a link.
 */

const toolButton = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-text",
  "transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft data-[state=open]:bg-primary-soft",
  focusRing,
);

const menuContent =
  "min-w-48 rounded-md border border-border bg-surface p-1 text-text shadow-[0_8px_24px_rgb(0_0_0/0.12)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--duration-fast)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

const menuItem =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm text-text outline-none data-[highlighted]:bg-primary-soft";

/** A one-choice menu: Sort by…, Group by…. The trigger names the choice. */
function ChoiceMenu<T extends string>(props: {
  label: string;
  icon: typeof IconSearch;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const current = () =>
    props.options.find((o) => o.value === props.value)?.label ?? "";
  return (
    <Menu.Root positioning={{ placement: "bottom-start", gutter: 4 }}>
      <Menu.Trigger class={toolButton}>
        <props.icon aria-hidden="true" class="size-4.5 text-text-muted" />
        {props.label}
        <span class="hidden text-text-muted lg:inline">: {current()}</span>
        <span class="sr-only lg:hidden">: {current()}</span>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content class={menuContent}>
            <Menu.RadioItemGroup
              value={props.value}
              onValueChange={(e) => props.onChange(e.value as T)}
            >
              <Menu.ItemGroupLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-text-muted">
                {props.label}
              </Menu.ItemGroupLabel>
              <For each={props.options}>
                {(option) => (
                  <Menu.RadioItem value={option.value} class={menuItem}>
                    <Menu.ItemText class="flex-1">{option.label}</Menu.ItemText>
                    <Menu.ItemIndicator class="text-primary">
                      <IconCheck aria-hidden="true" class="size-4" />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

export function TasksToolbar(props: {
  view: TasksView;
  members: TeamMember[];
  viewerId: string;
  /** Sort and group only mean something in the table. */
  tableTools: boolean;
  canCreate: boolean;
  onNew: () => void;
  onUpdate: (next: Partial<TasksView>) => void;
  onClear: () => void;
}) {
  const panelId = createUniqueId();
  const count = () => activeFilterCount(props.view);
  // Opens by itself when a link arrives already filtered, so the reason the
  // list looks short is on screen.
  const [filtersOpen, setFiltersOpen] = createSignal(count() > 0);

  // Search types into local state and reaches the URL after a short pause,
  // so the history isn't rewritten on every keystroke.
  const [text, setText] = createSignal(props.view.q);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  createEffect(
    on(
      () => props.view.q,
      (q) => {
        if (q !== text()) setText(q);
      },
      { defer: true },
    ),
  );

  function search(value: string) {
    setText(value);
    clearTimeout(timer);
    timer = setTimeout(() => props.onUpdate({ q: value }), 200);
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-x-1 gap-y-2">
        <button
          type="button"
          disabled={!props.canCreate}
          onClick={() => props.onNew()}
          class={cn(
            btnPrimary,
            "mr-2 min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <IconPlus aria-hidden="true" class="size-4.5" />
          New task
        </button>

        <label class="relative flex w-full items-center sm:w-56">
          <span class="sr-only">Search tasks</span>
          <IconSearch
            aria-hidden="true"
            class="pointer-events-none absolute left-3 size-4.5 text-text-muted"
          />
          <input
            type="search"
            value={text()}
            placeholder="Search"
            onInput={(e) => search(e.currentTarget.value)}
            class="h-11 w-full rounded-md border border-transparent bg-transparent pr-3 pl-9 text-base text-text placeholder:text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft focus:border-primary focus:bg-surface focus:outline-2 focus:outline-offset-0 focus:outline-primary md:text-sm"
          />
        </label>

        <button
          type="button"
          aria-expanded={filtersOpen()}
          aria-controls={panelId}
          onClick={() => setFiltersOpen((v) => !v)}
          class={cn(
            toolButton,
            count() > 0 &&
              "bg-primary text-primary-foreground hover:bg-primary hover:brightness-110",
          )}
        >
          <IconFilter
            aria-hidden="true"
            class={cn("size-4.5", count() === 0 && "text-text-muted")}
          />
          Filter
          <Show when={count() > 0}>
            <span class="font-mono tabular-nums">/ {count()}</span>
            <span class="sr-only">
              {count() === 1 ? " filter on" : " filters on"}
            </span>
          </Show>
        </button>

        <Show when={props.tableTools}>
          <ChoiceMenu
            label="Sort"
            icon={IconArrowsSort}
            options={SORT_OPTIONS}
            value={props.view.sort}
            onChange={(sort: SortKey) => props.onUpdate({ sort })}
          />
          <ChoiceMenu
            label="Group"
            icon={IconLayoutList}
            options={GROUP_OPTIONS}
            value={props.view.group}
            onChange={(group: GroupKey) => props.onUpdate({ group })}
          />
        </Show>

        <Show when={filtersActive(props.view)}>
          <button
            type="button"
            onClick={() => {
              clearTimeout(timer);
              props.onClear();
            }}
            class={cn(toolButton, "text-text-muted")}
          >
            <IconX aria-hidden="true" class="size-4.5" />
            Clear
          </button>
        </Show>
      </div>

      <div
        id={panelId}
        hidden={!filtersOpen()}
        class="rounded-lg border border-border bg-surface p-3"
      >
        <div class="flex flex-wrap items-end gap-3">
          <SelectField
            label="Assigned to"
            options={assigneeOptions(props.members, props.viewerId)}
            value={props.view.assignee}
            onChange={(assignee) => props.onUpdate({ assignee })}
            class="w-full sm:w-52"
          />
          <SelectField
            label="Priority"
            options={PRIORITY_FILTER_OPTIONS}
            value={props.view.priority}
            onChange={(priority) =>
              props.onUpdate({ priority: priority as PriorityFilter })
            }
            class="w-full sm:w-44"
          />
          <SelectField
            label="Due"
            options={DUE_OPTIONS}
            value={props.view.due}
            onChange={(due) => props.onUpdate({ due: due as DueFilter })}
            class="w-full sm:w-44"
          />
        </div>
      </div>
    </div>
  );
}
