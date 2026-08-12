import { Select, createListCollection } from "@ark-ui/solid/select";
import { For, type Component } from "solid-js";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";

const sectors = [
  "Agriculture",
  "Fishing",
  "Forestry",
  "Mining",
  "Natural resource management",
  "Manufacturing",
  "Construction",
  "Textile production",
  "Automotive industry",
  "Chemical processing",
  "Retail and wholesale",
  "Healthcare",
  "Education",
  "Financial services",
  "Transportation and logistics",
  "Knowledge-based services",
  "Intellectual property",
  "Technology and innovation",
  "Data analysis",
] as const;

const sectorItems = sectors.map((sector) => ({ label: sector, value: sector }));

const sectorCollection = createListCollection({ items: sectorItems });

interface SectorSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const triggerClass =
  "flex w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

export const SectorSelect: Component<SectorSelectProps> = (props) => {
  return (
    <Select.Root
      collection={sectorCollection}
      value={props.value ? [props.value] : []}
      onValueChange={(details) => props.onChange(details.value[0] ?? "")}
      positioning={{ placement: "bottom" }}
    >
      <Select.Label class="text-sm font-semibold text-foreground">
        Business Sector
      </Select.Label>
      <Select.Control>
        <Select.Trigger class={triggerClass}>
          <Select.ValueText
            placeholder="Select your business sector"
            class={props.value ? "text-foreground" : "text-muted-foreground"}
          />
          <ChevronDown
            class="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Select.Trigger>
      </Select.Control>

      <Select.Positioner>
        <Select.Content class="z-50 mt-1 min-w-52 rounded-md border border-border bg-card p-1 shadow-sm">
          <For each={sectorItems}>
            {(item) => (
              <Select.Item
                item={item}
                class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-foreground outline-none data-highlighted:bg-muted"
              >
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check class="size-4 text-primary" aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            )}
          </For>
        </Select.Content>
      </Select.Positioner>

      <Select.HiddenSelect />
    </Select.Root>
  );
};
