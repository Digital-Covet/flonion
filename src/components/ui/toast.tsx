import { createToaster, Toast, Toaster } from "@ark-ui/solid/toast";
import CheckCircle2 from "lucide-solid/icons/circle-check-big";
import XCircle from "lucide-solid/icons/circle-x";
import Info from "lucide-solid/icons/info";
import AlertTriangle from "lucide-solid/icons/triangle-alert";
import X from "lucide-solid/icons/x";
import { For } from "solid-js";
import { Portal } from "solid-js/web";

/**
 * Phase 1 primitive — spec E2: toast auto-dismiss 4s with pause-on-hover.
 * Status always icon + text label (§2), never hue alone.
 */
export const appToaster = createToaster({
  placement: "bottom",
  gap: 12,
  max: 4,
  pauseOnPageIdle: true,
});

type ToastKind = "success" | "error" | "warning" | "info";

const kindStyles: Record<ToastKind, string> = {
  success: "border-success/25 text-success",
  error: "border-destructive/25 text-destructive",
  warning: "border-warning/25 text-warning",
  info: "border-primary/25 text-primary",
};

const kindIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

export function notify(kind: ToastKind, title: string, description?: string) {
  appToaster.create({
    type: kind,
    duration: 4000,
    title,
    description,
  });
}

export function AppToaster() {
  return (
    <Portal>
      <Toaster toaster={appToaster}>
        {(toast) => {
          const kind = () => (toast().type ?? "info") as ToastKind;
          const Icon = () => kindIcons[kind()];
          return (
            <Toast.Root class="e2-enter flex w-80 items-start gap-3 rounded-card border border-border bg-card p-3 shadow-md">
              <span class={`mt-0.5 inline-flex shrink-0 ${kindStyles[kind()]}`}>
                {(() => {
                  const C = Icon();
                  return <C class="size-5" aria-hidden="true" />;
                })()}
              </span>
              <div class="min-w-0 flex-1">
                <Toast.Title class="text-sm font-medium text-foreground">
                  {toast().title}
                </Toast.Title>
                <For each={toast().description ? [toast().description] : []}>
                  {(desc) => (
                    <Toast.Description class="mt-0.5 text-sm text-muted-foreground">
                      {desc}
                    </Toast.Description>
                  )}
                </For>
              </div>
              <Toast.CloseTrigger
                aria-label="Dismiss notification"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted hover:text-foreground motion-reduce:transition-none"
              >
                <X class="size-4" aria-hidden="true" />
              </Toast.CloseTrigger>
            </Toast.Root>
          );
        }}
      </Toaster>
    </Portal>
  );
}
