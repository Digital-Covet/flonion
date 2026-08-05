import Building2 from "lucide-solid/icons/building-2";
import Phone from "lucide-solid/icons/phone";
import MapPin from "lucide-solid/icons/map-pin";
import { Show } from "solid-js";

interface BusinessInfoSectionProps {
  logo?: string | null;
  businessName?: string;
  phone?: string;
  address?: string;
}

export function BusinessInfoSection(props: BusinessInfoSectionProps) {
  return (
    <section
      aria-labelledby="business-info-heading"
      class="mb-6 rounded-xl border border-border bg-card p-5 shadow-md"
    >
      <h2
        id="business-info-heading"
        class="mb-4 text-lg font-semibold text-foreground"
      >
        Business Information
      </h2>

      <div class="flex items-start gap-4">
        <Show when={props.logo}>
          <img
            src={props.logo!}
            alt="Company logo"
            class="h-14 w-14 shrink-0 rounded-lg object-contain"
          />
        </Show>

        <div class="min-w-0 space-y-2">
          <Show when={props.businessName}>
            <p class="truncate text-base font-medium text-foreground">
              {props.businessName}
            </p>
          </Show>

          <Show when={props.phone}>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone class="size-4 shrink-0" aria-hidden="true" />
              <span class="truncate">{props.phone}</span>
            </div>
          </Show>

          <Show when={props.address}>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin class="size-4 shrink-0" aria-hidden="true" />
              <span class="truncate">{props.address}</span>
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}
