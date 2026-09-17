import { type Component, For, Show } from "solid-js";

// Spec §6 labels: Basics → Platforms → Review settings → Invite.
const steps = ["Basics", "Platforms", "Review settings", "Invite"] as const;

interface ProgressStepperProps {
  currentStep: number;
  /** Back-navigation to an already-visited step; forward jumps disallowed. */
  onStep?: (step: number) => void;
}

export const ProgressStepper: Component<ProgressStepperProps> = (props) => {
  const progressWidth = () => {
    if (props.currentStep <= 1) return "w-0";
    if (props.currentStep === 2) return "w-1/3";
    if (props.currentStep === 3) return "w-2/3";
    return "w-full";
  };

  return (
    <nav class="w-full px-4" aria-label="Onboarding progress">
      <ol class="relative flex items-start justify-between">
        <div
          class="absolute left-4 right-4 top-4 -z-10 h-1 rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            class={`h-full rounded-full bg-primary transition-[width] duration-500 ${progressWidth()}`}
          />
        </div>

        <For each={steps}>
          {(label, index) => {
            const step = index() + 1;
            const reached = () => props.currentStep >= step;
            const active = () => props.currentStep === step;
            // Only visited steps are clickable — no skipping ahead past
            // unsaved work; the current node stays a status indicator.
            const clickable = () =>
              Boolean(props.onStep) && step < props.currentStep;

            return (
              <li
                class="flex min-w-16 flex-col items-center gap-2"
                aria-current={active() ? "step" : undefined}
              >
                <Show
                  when={clickable()}
                  fallback={
                    <span
                      class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors duration-300"
                      classList={{
                        "border-primary bg-primary text-primary-foreground":
                          reached(),
                        "border-border bg-muted text-muted-foreground":
                          !reached(),
                        "ring-4 ring-primary/20": active(),
                      }}
                    >
                      {step}
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => props.onStep!(step)}
                    aria-label={`Go back to step ${step}: ${label}`}
                    class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary text-sm font-medium text-primary-foreground transition-opacity duration-[180ms] hover:opacity-80 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {step}
                  </button>
                </Show>
                <span
                  class="max-w-20 text-center text-xs font-medium transition-colors duration-300"
                  classList={{
                    "text-primary": active(),
                    "text-muted-foreground": !active(),
                  }}
                >
                  {label}
                </span>
              </li>
            );
          }}
        </For>
      </ol>
    </nav>
  );
};
