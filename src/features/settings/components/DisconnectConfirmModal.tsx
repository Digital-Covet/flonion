import { Show } from "solid-js";
import X from "lucide-solid/icons/x";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Loader2 from "lucide-solid/icons/loader-2";

interface DisconnectConfirmModalProps {
  isOpen: boolean;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DisconnectConfirmModal(props: DisconnectConfirmModalProps) {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={props.onClose}
        />
        <div class="relative z-10 mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
          <button
            type="button"
            onClick={props.onClose}
            class="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div class="mb-4 flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-foreground">
                Disconnect Google Account
              </h3>
              <p class="mt-1 text-sm leading-5 text-muted-foreground">
                Disconnecting will unlink your Google account and revoke access for both{" "}
                <span class="font-medium text-foreground">Google Business Profile</span> and{" "}
                <span class="font-medium text-foreground">Google Meet</span>.
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={props.onClose}
              disabled={props.loading}
              class="h-9 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={props.loading}
              class="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {props.loading && <Loader2 size={16} class="animate-spin" />}
              {props.loading ? "Disconnecting..." : "Disconnect Account"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
