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
  const [isSubmitting, setIsSubmitting] = createSignal(false);

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
    }
  });

  const handleSubmit = async () => {
    if (!title().trim() || !assignee() || isSubmitting()) return;

    setIsSubmitting(true);
    try {
      if (isEdit() && props.task) {
        await updateTask(props.task.id, {
          title: title().trim(),
          description: description().trim(),
          assigneeId: assignee(),
          priority: priority(),
        });
      } else {
        await addTask({
          title: title().trim(),
          description: description().trim() || undefined,
          assigneeId: assignee(),
          priority: priority(),
          column: "todo",
        });
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
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <Dialog.Title class="text-xl font-bold font-heading text-foreground">
                {isEdit() ? "Edit Task" : "Add Task"}
              </Dialog.Title>
              <Dialog.CloseTrigger class="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer">
                <X size={20} />
              </Dialog.CloseTrigger>
            </div>
            <Dialog.Description class="text-sm text-muted-foreground mb-4">
              {isEdit()
                ? "Update this task's details."
                : "Create a new project task and assign it to a team member."}
            </Dialog.Description>

            <div class="flex flex-col gap-4">
              <div>
                <label
                  class="block text-sm font-medium text-foreground mb-1"
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
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-foreground mb-1"
                  for="task-description"
                >
                  Description
                </label>
                <textarea
                  id="task-description"
                  placeholder="Optional details"
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-y"
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
                  <Select.Label class="block text-sm font-medium text-foreground mb-1">
                    Assignee
                  </Select.Label>
                  <Select.Control class="w-full">
                    <Select.Trigger class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none flex items-center justify-between">
                      <Select.ValueText placeholder="Select a team member" />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content class="bg-card border border-border rounded-lg shadow-lg p-1 z-[60]">
                        <Show
                          when={assigneeCollection().items.length > 0}
                          fallback={
                            <p class="px-4 py-2 text-sm text-muted-foreground">
                              No team members available
                            </p>
                          }
                        >
                          <For each={assigneeCollection().items}>
                            {(item) => (
                              <Select.Item
                                item={item}
                                class="px-4 py-2 text-sm text-foreground rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
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
                <Select.Root
                  collection={priorityCollection}
                  value={[priority()]}
                  onValueChange={(details) => {
                    if (details.value[0]) setPriority(details.value[0]);
                  }}
                >
                  <Select.Label class="block text-sm font-medium text-foreground mb-1">
                    Priority
                  </Select.Label>
                  <Select.Control class="w-full">
                    <Select.Trigger class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none flex items-center justify-between">
                      <Select.ValueText placeholder="Select priority" />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content class="bg-card border border-border rounded-lg shadow-lg p-1 z-[60]">
                        <For each={priorityCollection.items}>
                          {(item) => (
                            <Select.Item
                              item={item}
                              class="px-4 py-2 text-sm text-foreground rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
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

            <div class="mt-6 flex justify-end gap-3">
              <Dialog.CloseTrigger class="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-border transition-colors cursor-pointer">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title().trim() || !assignee() || isSubmitting()}
                class="px-4 py-2 text-sm font-medium text-background bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEdit() ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
