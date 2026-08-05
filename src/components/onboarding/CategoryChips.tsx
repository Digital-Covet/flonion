import { For, Show, createSignal, type Component } from "solid-js";
import CircleCheck from "lucide-solid/icons/circle-check";

const categories = ["Restaurant", "Salon/Spa", "Retail", "Healthcare", "Other"] as const;

interface CategoryChipsProps {
  value: string;
  onChange: (value: string) => void;
}

export const CategoryChips: Component<CategoryChipsProps> = (props) => {
  return (
    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm font-semibold text-foreground">Business Category</legend>
      <div class="flex flex-wrap gap-2">
        <For each={categories}>
          {(category) => {
            const isSelected = () => props.value === category;

            return (
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                classList={{
                  "border-primary bg-primary text-primary-foreground": isSelected(),
                  "border-border bg-background text-foreground hover:bg-muted": !isSelected(),
                }}
                aria-pressed={isSelected()}
                onClick={() => props.onChange(category)}
              >
                <Show when={isSelected()}>
                  <CircleCheck size={18} strokeWidth={2} aria-hidden="true" />
                </Show>
                {category}
              </button>
            );
          }}
        </For>
      </div>
    </fieldset>
  );
};
