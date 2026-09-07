import Clock from "lucide-solid/icons/clock";
import { type Component, Show } from "solid-js";

interface JoinPendingStepProps {
  businessName: string;
  createdAt: string;
  cancelling: boolean;
  error: string;
  onCancel: () => void;
  onCreateInstead: () => void;
}

/**
 * Where a requester waits.
 *
 * They still have `onboardingCompleted: false`, so the middleware onboarding
 * gate keeps them on this page until an admin acts -- which is why the waiting
 * state lives here rather than on the dashboard.
 */
export const JoinPendingStep: Component<JoinPendingStepProps> = (props) => {
  const sentOn = () => {
    const date = new Date(props.createdAt);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <div class="flex flex-col items-center gap-4 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Clock size={22} class="text-primary" aria-hidden="true" />
      </div>

      <div>
        <p class="text-base text-muted-foreground">
          Your request to join{" "}
          <span class="font-medium text-foreground">{props.businessName}</span>{" "}
          is waiting for approval.
        </p>
        <Show when={sentOn()}>
          <p class="mt-1 text-sm text-muted-foreground">Sent {sentOn()}</p>
        </Show>
      </div>

      <p class="text-sm text-muted-foreground">
        An owner or admin will review it and pick your role. This page updates
        on its own once they do.
      </p>

      <Show when={props.error}>
        <p role="alert" class="text-sm text-destructive">
          {props.error}
        </p>
      </Show>

      <div class="mt-2 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={props.onCancel}
          disabled={props.cancelling}
          class="rounded-lg bg-muted px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
        >
          {props.cancelling ? "Cancelling..." : "Cancel request"}
        </button>
        <button
          type="button"
          onClick={props.onCreateInstead}
          disabled={props.cancelling}
          class="rounded-lg bg-card px-6 py-2.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
        >
          Set up my own business instead
        </button>
      </div>
    </div>
  );
};
