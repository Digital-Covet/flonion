import { IconCheck, IconMinus } from "@tabler/icons-solidjs";
import { For, Show } from "solid-js";
import { type Billing, type Cell, inr, type Plan } from "~/lib/plans";

/** Native radios so the switch works before hydration and with a keyboard. */
export function BillingToggle(props: {
  value: Billing;
  onChange: (b: Billing) => void;
  class?: string;
}) {
  const option =
    "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-4 font-display text-sm font-semibold text-text-muted transition-colors duration-[var(--duration-fast)] has-[:checked]:bg-surface has-[:checked]:text-text has-[:checked]:shadow-[0_1px_3px_rgb(28_25_23/0.12)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";

  return (
    <fieldset class={props.class}>
      <legend class="sr-only">Billing period</legend>
      <div class="inline-flex rounded-lg border border-border-strong bg-primary-soft/60 p-1">
        <label class={option}>
          <input
            type="radio"
            name="billing"
            value="monthly"
            class="sr-only"
            checked={props.value === "monthly"}
            onChange={() => props.onChange("monthly")}
          />
          Monthly
        </label>
        <label class={option}>
          <input
            type="radio"
            name="billing"
            value="yearly"
            class="sr-only"
            checked={props.value === "yearly"}
            onChange={() => props.onChange("yearly")}
          />
          Yearly
          <span class="rounded-full bg-accent-soft px-2 py-0.5 font-sans text-xs font-medium text-accent">
            Save 20%
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/** Headline price plus the one-line billing explanation under it. */
export function PlanPrice(props: { plan: Plan; billing: Billing }) {
  return (
    <Show
      when={props.plan.price}
      fallback={
        <>
          <p class="mt-6 font-display text-4xl font-semibold">Custom</p>
          <p class="mt-1 min-h-6 text-sm text-text-muted">
            Quoted for your locations and team
          </p>
        </>
      }
    >
      {(price) => (
        <>
          <p class="mt-6 flex items-baseline gap-1.5">
            <span class="font-mono text-4xl font-medium tabular-nums">
              ₹{inr.format(price()[props.billing])}
            </span>
            <span class="text-sm text-text-muted">
              {price().monthly === 0 ? "forever" : "/ month"}
            </span>
          </p>
          <p aria-live="polite" class="mt-1 min-h-6 text-sm text-text-muted">
            <Show when={price().monthly > 0} fallback="No card needed">
              <Show
                when={props.billing === "yearly"}
                fallback={
                  <>
                    or{" "}
                    <span class="font-mono tabular-nums">
                      ₹{inr.format(price().yearly)}
                    </span>
                    /month billed yearly
                  </>
                }
              >
                Billed{" "}
                <span class="font-mono tabular-nums">
                  ₹{inr.format(price().yearly * 12)}
                </span>{" "}
                yearly
              </Show>
            </Show>
          </p>
        </>
      )}
    </Show>
  );
}

export function FeatureList(props: { features: string[] }) {
  return (
    <ul class="mt-6 flex flex-col gap-3 border-t border-border pt-6 text-sm">
      <For each={props.features}>
        {(feature) => (
          <li class="flex gap-2.5">
            <IconCheck
              aria-hidden="true"
              class="mt-0.5 size-4 shrink-0 text-secondary"
            />
            <span>{feature}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

/** Included/not included is an icon plus hidden text, never colour alone. */
export function CellValue(props: { value: Cell }) {
  return (
    <Show
      when={typeof props.value !== "string"}
      fallback={<span class="font-mono tabular-nums">{props.value}</span>}
    >
      <Show
        when={props.value}
        fallback={
          <>
            <IconMinus
              aria-hidden="true"
              class="mx-auto size-4 text-text-muted"
            />
            <span class="sr-only">Not included</span>
          </>
        }
      >
        <IconCheck aria-hidden="true" class="mx-auto size-5 text-secondary" />
        <span class="sr-only">Included</span>
      </Show>
    </Show>
  );
}
