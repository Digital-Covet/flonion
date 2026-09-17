import Building2 from "lucide-solid/icons/building-2";
import Edit from "lucide-solid/icons/edit";
import ExternalLink from "lucide-solid/icons/external-link";
import Globe from "lucide-solid/icons/globe";
import MapPin from "lucide-solid/icons/map-pin";
import Phone from "lucide-solid/icons/phone";
import Star from "lucide-solid/icons/star";
import { type Component, For } from "solid-js";
import type { BusinessInfo } from "~/features/seo/seo-types";

interface BusinessInfoCardProps {
  info: BusinessInfo;
}

const StarRating: Component<{ rating: number; reviewCount: number }> = (
  props,
) => {
  return (
    <div class="flex items-center gap-1.5">
      <div class="flex items-center gap-0.5">
        <For each={[1, 2, 3, 4, 5]}>
          {(i) => (
            <Star
              size={14}
              class={
                i <= Math.round(props.rating)
                  ? "fill-star text-star"
                  : "text-border"
              }
            />
          )}
        </For>
      </div>
      <span class="tnum text-sm font-medium text-foreground">{props.rating}</span>
      <span class="text-xs text-muted-foreground">({props.reviewCount} reviews)</span>
    </div>
  );
};

const InfoRow: Component<{
  icon: typeof Phone;
  label: string;
  value: string;
}> = (props) => (
  <div class="flex items-start gap-3">
    <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
      <props.icon size={16} />
    </div>
    <div class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {props.label}
      </p>
      <p class="text-sm text-foreground truncate">{props.value}</p>
    </div>
  </div>
);

const BusinessInfoCard: Component<BusinessInfoCardProps> = (props) => {
  return (
    <div class="rounded-card border border-border bg-card p-6 shadow-sm">
      <div class="mb-5 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-control bg-primary/10 text-primary">
            <Building2 size={20} />
          </div>
          <div>
            <h3 class="font-heading text-lg font-medium text-foreground">{props.info.name}</h3>
            <p class="text-xs text-muted-foreground">Google Business Profile</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={props.info.reviewLink}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-control border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <ExternalLink size={12} />
            View on Google
          </a>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-control border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Edit size={12} />
            Edit Profile
          </button>
        </div>
      </div>

      <p class="mb-5 text-sm leading-relaxed text-muted-foreground">
        {props.info.description}
      </p>

      <div class="mb-5 flex flex-wrap gap-2">
        <For each={props.info.categories}>
          {(cat) => (
            <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {cat}
            </span>
          )}
        </For>
      </div>

      <StarRating
        rating={props.info.rating}
        reviewCount={props.info.reviewCount}
      />

      <div class="mt-5 space-y-4 border-t border-border pt-5">
        <InfoRow icon={Phone} label="Phone" value={props.info.phone} />
        <InfoRow icon={Globe} label="Website" value={props.info.website} />
        <InfoRow icon={MapPin} label="Address" value={props.info.address} />
      </div>

      <div class="mt-5 border-t border-border pt-5">
        <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Operating Hours
        </p>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          <For each={Object.entries(props.info.hours)}>
            {([day, hours]) => (
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-foreground">{day}</span>
                <span class="tnum text-muted-foreground">
                  {hours.closed ? "Closed" : `${hours.open} - ${hours.close}`}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export default BusinessInfoCard;
