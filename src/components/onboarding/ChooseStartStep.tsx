import ArrowRight from "lucide-solid/icons/arrow-right";
import Building2 from "lucide-solid/icons/building-2";
import Users from "lucide-solid/icons/users";
import type { Component } from "solid-js";

interface ChooseStartStepProps {
  onCreate: () => void;
  onJoin: () => void;
}

const cardClass =
  "group flex w-full items-start gap-4 rounded-lg border border-border bg-background p-4 text-left shadow-sm outline-none transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10";

/**
 * The fork before onboarding commits someone to owning a business.
 *
 * Creating a business used to be the only option here, which quietly made it the
 * default for people who had simply signed up ahead of their invitation -- and a
 * business is much harder to get out of than into.
 */
export const ChooseStartStep: Component<ChooseStartStepProps> = (props) => {
  return (
    <div class="flex flex-col gap-3">
      <button type="button" onClick={props.onCreate} class={cardClass}>
        <Building2
          size={22}
          class="mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span class="flex-1">
          <span class="block font-medium text-foreground">
            Set up a new business
          </span>
          <span class="mt-1 block text-sm text-muted-foreground">
            You're the owner. Add your details, then invite your team.
          </span>
        </span>
        <ArrowRight
          size={18}
          class="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>

      <button type="button" onClick={props.onJoin} class={cardClass}>
        <Users
          size={22}
          class="mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span class="flex-1">
          <span class="block font-medium text-foreground">
            Join an existing team
          </span>
          <span class="mt-1 block text-sm text-muted-foreground">
            Your team is already on Flonion. Ask them to add you.
          </span>
        </span>
        <ArrowRight
          size={18}
          class="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </div>
  );
};
