import { For, type Component } from "solid-js";

const steps = ["Basics", "Platforms", "Review", "Team"] as const;

interface ProgressStepperProps {
  currentStep: number;
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

            return (
              <li
                class="flex min-w-16 flex-col items-center gap-2"
                aria-current={active() ? "step" : undefined}
              >
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-300"
                  classList={{
                    "border-primary bg-primary text-primary-foreground": reached(),
                    "border-border bg-muted text-muted-foreground": !reached(),
                    "ring-4 ring-primary/20": active(),
                  }}
                >
                  {step}
                </span>
                <span
                  class="font-heading text-xs font-semibold transition-colors duration-300"
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
