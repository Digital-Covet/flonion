import { Dialog } from "@ark-ui/solid/dialog";
import { createListCollection, Select } from "@ark-ui/solid/select";
import { X } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { type Task, useTaskContext } from "~/stores/task-store";

const priorityCollection = createListCollection({
  items: [
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
  ],
});

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this task; otherwise it creates a new one. */
  task?: Task | null;
}

export default function TaskDialog(props: TaskDialogProps) {
  const { teamMembers, addTask, updateTask } = useTaskContext();
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [assignee, setAssignee] = createSignal("");
  const [priority, setPriority] = createSignal("medium");
  const [dueDate, setDueDate] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const isEdit = () => !!props.task;

  const assigneeCollection = createMemo(() =>
    createListCollection({
      items: teamMembers().map((member) => ({
        label: member.name,
        value: member.id,
      })),
    }),
  );

  // Prefill on open so reopening the dialog for a different task never shows
  // stale values from the previous one.
  createEffect(() => {
    if (props.open) {
      const task = props.task;
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setAssignee(task?.assigneeId ?? "");
      const taskPriority = task?.priority ?? "medium";
      setPriority(
        priorityCollection.items.some((item) => item.value === taskPriority)
          ? taskPriority
          : "medium",
      );
      // Stored as ISO; the date input wants YYYY-MM-DD.
      setDueDate((task?.dueDate ?? "").slice(0, 10));
      setSubmitError(null);
    }
  });

  const handleSubmit = async () => {
    if (!title().trim() || !assignee() || isSubmitting()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const due = dueDate().trim() || undefined;
      if (isEdit() && props.task) {
        const ok = await updateTask(props.task.id, {
          title: title().trim(),
          description: description().trim(),
          assigneeId: assignee(),
          priority: priority(),
          dueDate: due ?? null,
        });
        if (!ok) {
          setSubmitError("Couldn't save this task. Please try again.");
          return;
        }
      } else {
        const created = await addTask({
          title: title().trim(),
          description: description().trim() || undefined,
          assigneeId: assignee(),
          priority: priority(),
          dueDate: due,
          column: "todo",
        });
        if (!created) {
          setSubmitError("Couldn't create this task. Please try again.");
          return;
        }
      }
      props.onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Content class="e2-enter flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-soft border border-border bg-card shadow-lg sm:rounded-card">
            <div class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <Dialog.Title class="font-heading text-xl font-semibold text-foreground">
                {isEdit() ? "Edit Task" : "Add Task"}
              </Dialog.Title>
              <Dialog.CloseTrigger
                aria-label="Close task dialog"
                class="grid min-h-11 min-w-11 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X size={20} aria-hidden="true" />
              </Dialog.CloseTrigger>
            </div>
            <Dialog.Description class="px-5 pt-3 text-sm text-muted-foreground">
              {isEdit()
                ? "Update this task's details."
                : "Create a new project task and assign it to a team member."}
            </Dialog.Description>

            <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-foreground"
                  for="task-title"
                >
                  Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  placeholder="Task title"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  class="min-h-11 w-full rounded-control border border-control bg-card px-3 py-2.5 text-base text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm font-medium text-foreground"
                  for="task-description"
                >
                  Description
                </label>
                <textarea
                  id="task-description"
                  placeholder="Optional details"
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  class="min-h-20 w-full resize-y rounded-control border border-control bg-card px-3 py-2.5 text-base text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>

              <div>
                <Select.Root
                  collection={assigneeCollection()}
                  value={assignee() ? [assignee()] : []}
                  onValueChange={(details) => {
                    if (details.value[0]) setAssignee(details.value[0]);
                  }}
                >
                  <Select.Label class="mb-1 block text-sm font-medium text-foreground">
                    Assignee
                  </Select.Label>
                  <Select.Control class="w-full">
                    <Select.Trigger class="flex min-h-11 w-full items-center justify-between rounded-control border border-control bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <Select.ValueText placeholder="Select a team member" />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content class="rounded-card border border-border bg-card p-1.5 shadow-lg z-[60]">
                        <Show
                          when={assigneeCollection().items.length > 0}
                          fallback={
                            <p class="px-4 py-2.5 text-sm text-muted-foreground">
                              No team members available
                            </p>
                          }
                        >
                          <For each={assigneeCollection().items}>
                            {(item) => (
                              <Select.Item
                                item={item}
                                class="min-h-11 rounded-control px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                              >
                                <Select.ItemText>{item.label}</Select.ItemText>
                              </Select.Item>
                            )}
                          </For>
                        </Show>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                  <Select.HiddenSelect />
                </Select.Root>
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-foreground mb-1"
                  for="task-due-date"
                >
                  Due date
                  <span class="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate()}
                  onInput={(e) => setDueDate(e.currentTarget.value)}
                  class="tnum min-h-11 w-full rounded-control border border-control bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>

              <div>
                <Select.Root
                  collection={priorityCollection}
                  value={[priority()]}
                  onValueChange={(details) => {
                    if (details.value[0]) setPriority(details.value[0]);
                  }}
                >
                  <Select.Label class="mb-1 block text-sm font-medium text-foreground">
                    Priority
                  </Select.Label>
                  <Select.Control class="w-full">
                    <Select.Trigger class="flex min-h-11 w-full items-center justify-between rounded-control border border-control bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <Select.ValueText placeholder="Select priority" />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content class="rounded-card border border-border bg-card p-1.5 shadow-lg z-[60]">
                        <For each={priorityCollection.items}>
                          {(item) => (
                            <Select.Item
                              item={item}
                              class="min-h-11 rounded-control px-4 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                            >
                              <Select.ItemText>{item.label}</Select.ItemText>
                            </Select.Item>
                          )}
                        </For>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                  <Select.HiddenSelect />
                </Select.Root>
              </div>
            </div>

            <Show when={submitError()}>
              <p role="alert" class="px-5 pt-2 text-sm text-destructive">
                {submitError()}
              </p>
            </Show>

            <div class="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:gap-2.5">
              <Dialog.CloseTrigger class="inline-flex min-h-11 items-center justify-center rounded-control bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title().trim() || !assignee() || isSubmitting()}
                class="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isSubmitting()
                  ? "Saving…"
                  : isEdit()
                    ? "Save Changes"
                    : "Create Task"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
