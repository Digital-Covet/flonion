import { type Component } from "solid-js";
import ArrowRight from "lucide-solid/icons/arrow-right";
import Search from "lucide-solid/icons/search";
import { CategoryChips } from "./CategoryChips";
import { LogoUpload } from "./LogoUpload";

export interface BasicsData {
  businessName: string;
  address: string;
  city: string;
  pinCode: string;
  category: string;
  keywords: string;
  logo: string | null;
}

interface BasicsStepProps {
  data: BasicsData;
  onChange: (data: Partial<BasicsData>) => void;
  onContinue: () => void;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-base text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

export const BasicsStep: Component<BasicsStepProps> = (props) => {
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!props.data.businessName.trim()) return;
    props.onContinue();
  };

  return (
    <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-foreground" for="business-name">
          Business Name
        </label>
        <input
          class={inputClass}
          id="business-name"
          type="text"
          placeholder="Search your business name..."
          value={props.data.businessName}
          onInput={(e) => props.onChange({ businessName: e.currentTarget.value })}
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-foreground" for="business-address-search">
          Business Location
        </label>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            class={`${inputClass} pl-10`}
            id="business-address-search"
            type="text"
            placeholder="Search your business or enter address"
            value={props.data.address}
            onInput={(e) => props.onChange({ address: e.currentTarget.value })}
          />
        </div>
        <div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label class="sr-only" for="business-city">
              City
            </label>
            <input
              class={inputClass}
              id="business-city"
              type="text"
              placeholder="City"
              value={props.data.city}
              onInput={(e) => props.onChange({ city: e.currentTarget.value })}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="sr-only" for="business-pin-code">
              PIN Code
            </label>
            <input
              class={inputClass}
              id="business-pin-code"
              type="text"
              inputmode="numeric"
              placeholder="PIN Code"
              value={props.data.pinCode}
              onInput={(e) => props.onChange({ pinCode: e.currentTarget.value })}
            />
          </div>
        </div>
      </div>

      <CategoryChips
        value={props.data.category}
        onChange={(category) => props.onChange({ category })}
      />

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-foreground" for="business-keywords">
          Business Keywords
        </label>
        <input
          class={inputClass}
          id="business-keywords"
          type="text"
          placeholder="e.g., fine dining, vegan, family friendly"
          value={props.data.keywords}
          onInput={(e) => props.onChange({ keywords: e.currentTarget.value })}
        />
      </div>

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
