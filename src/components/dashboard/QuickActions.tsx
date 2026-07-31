import { For } from "solid-js";
import { quickActions } from "~/features/dashboard/data";

export function QuickActions() {
  return (
    <section
      aria-labelledby="quick-actions-heading"
      class="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <h2
        id="quick-actions-heading"
        class="text-lg font-semibold text-foreground"
      >
        Quick Actions
      </h2>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <For each={quickActions}>
          {(action) => (
            <a
              href={action.href}
              class="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
            >
              <action.icon size={18} class="text-primary" />
              <span class="text-sm font-medium text-foreground">
                {action.label}
              </span>
              <span class="text-xs text-muted-foreground">
                {action.description}
              </span>
            </a>
          )}
        </For>
      </div>
    </section>
  );
}
