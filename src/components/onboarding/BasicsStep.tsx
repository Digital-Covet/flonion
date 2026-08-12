import { Index, type Component } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import { TagsInput } from "@ark-ui/solid/tags-input";
import ArrowRight from "lucide-solid/icons/arrow-right";
import Search from "lucide-solid/icons/search";
import X from "lucide-solid/icons/x";
import { CategoryChips } from "./CategoryChips";
import { LogoUpload } from "./LogoUpload";
import { SectorSelect } from "./SectorSelect";

export interface BasicsData {
  businessName: string;
  address: string;
  city: string;
  pinCode: string;
  category: string;
  sector: string;
  keywords: string;
  logo: string | null;
}

interface BasicsStepProps {
  data: BasicsData;
  onChange: (data: Partial<BasicsData>) => void;
  onContinue: () => void;
}

const fieldInputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

export const BasicsStep: Component<BasicsStepProps> = (props) => {
  const parsedKeywords = () =>
    props.data.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!props.data.businessName.trim()) return;
    props.onContinue();
  };

  return (
    <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field.Root>
        <Field.Label
          for="business-name"
          class="text-sm font-semibold text-foreground"
        >
          Business Name
        </Field.Label>
        <Field.Input
          id="business-name"
          type="text"
          placeholder="Search your business name..."
          value={props.data.businessName}
          onInput={(e) => props.onChange({ businessName: e.currentTarget.value })}
          class={fieldInputClass}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label
          for="business-address-search"
          class="text-sm font-semibold text-foreground"
        >
          Business Location
        </Field.Label>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
          <Field.Input
            id="business-address-search"
            type="text"
            placeholder="Search your business or enter address"
            value={props.data.address}
            onInput={(e) => props.onChange({ address: e.currentTarget.value })}
            class={`${fieldInputClass} pl-10`}
          />
        </div>
        <div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field.Root>
            <Field.Label for="business-city" class="sr-only">
              City
            </Field.Label>
            <Field.Input
              id="business-city"
              type="text"
              placeholder="City"
              value={props.data.city}
              onInput={(e) => props.onChange({ city: e.currentTarget.value })}
              class={fieldInputClass}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label for="business-pin-code" class="sr-only">
              PIN Code
            </Field.Label>
            <Field.Input
              id="business-pin-code"
              type="text"
              inputmode="numeric"
              placeholder="PIN Code"
              value={props.data.pinCode}
              onInput={(e) => props.onChange({ pinCode: e.currentTarget.value })}
              class={fieldInputClass}
            />
          </Field.Root>
        </div>
      </Field.Root>

      <CategoryChips
        value={props.data.category}
        onChange={(category) => props.onChange({ category })}
      />

      <SectorSelect
        value={props.data.sector}
        onChange={(sector) => props.onChange({ sector })}
      />

      <TagsInput.Root
        value={parsedKeywords()}
        onValueChange={(details) =>
          props.onChange({ keywords: details.value.join(", ") })
        }
        delimiter=","
        blurBehavior="add"
        addOnPaste
        validate={({ inputValue }) => {
          const trimmed = inputValue.trim();
          const existing = parsedKeywords();
          return trimmed !== "" && !existing.includes(trimmed);
        }}
      >
        <TagsInput.Context>
          {(api) => (
            <>
              <TagsInput.Label class="text-sm font-semibold text-foreground">
                Business Keywords
              </TagsInput.Label>
              <TagsInput.Control class="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <Index each={api().value}>
                  {(keyword, index) => (
                    <TagsInput.Item
                      index={index}
                      value={keyword()}
                      class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
                    >
                      <TagsInput.ItemPreview>
                        <TagsInput.ItemText>{keyword()}</TagsInput.ItemText>
                        <TagsInput.ItemDeleteTrigger class="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <X size={12} />
                        </TagsInput.ItemDeleteTrigger>
                      </TagsInput.ItemPreview>
                      <TagsInput.ItemInput />
                    </TagsInput.Item>
                  )}
                </Index>
                <TagsInput.Input
                  placeholder="e.g., fine dining, vegan, family friendly"
                  class="h-8 min-w-40 flex-1 bg-transparent px-2 text-sm placeholder:text-muted-foreground focus:outline-none"
                />
              </TagsInput.Control>
            </>
          )}
        </TagsInput.Context>
        <TagsInput.HiddenInput />
      </TagsInput.Root>
      <p class="text-xs text-muted-foreground">
        Press Enter or comma to add. Click X to remove.
      </p>

      <LogoUpload
        logo={props.data.logo}
        onChange={(logo) => props.onChange({ logo })}
      />

      <div class="mt-1 flex justify-end">
        <button
          class="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
          type="submit"
          disabled={!props.data.businessName.trim()}
        >
          Continue
          <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};
