import ArrowLeft from "lucide-solid/icons/arrow-left";
import MapPin from "lucide-solid/icons/map-pin";
import Pencil from "lucide-solid/icons/pencil";
import Star from "lucide-solid/icons/star";
import Tag from "lucide-solid/icons/tag";
import { type Component, For, Show } from "solid-js";
import type { BasicsData } from "./BasicsStep";

interface ReviewStepProps {
  data: BasicsData;
  onComplete: () => void;
  onBack: () => void;
  /** Jump back to step 1 to edit details. */
  onEdit?: () => void;
  saving: boolean;
}

export const ReviewStep: Component<ReviewStepProps> = (props) => {
  const addressDisplay = () => {
    const parts = [
      props.data.address,
      props.data.city,
      props.data.pinCode,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const keywordList = () =>
    props.data.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const sectorDisplay = () =>
    props.data.sector === "Other" && props.data.customSector.trim()
      ? props.data.customSector
      : props.data.sector;

  return (
    <div class="flex flex-col gap-6">
      <p class="text-center text-sm text-muted-foreground">
        This is how customers will see your business on Flonion.
      </p>

      <div class="rounded-card border border-border bg-card p-6 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Profile preview
          </p>
          <Show when={props.onEdit}>
            <button
              type="button"
              onClick={props.onEdit}
              class="inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium text-primary transition-opacity duration-[180ms] hover:bg-positive-muted motion-reduce:transition-none"
            >
              <Pencil size={14} strokeWidth={2} aria-hidden="true" />
              Edit details
            </button>
          </Show>
        </div>
        <div class="mt-2 flex items-start gap-4">
          <Show
            when={props.data.logo}
            fallback={
              <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-xl font-semibold text-primary">
                {props.data.businessName.charAt(0).toUpperCase()}
              </div>
            }
          >
            <img
              src={props.data.logo!}
              alt={`${props.data.businessName} logo`}
              class="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          </Show>

          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-medium text-foreground truncate">
              {props.data.businessName || "Your Business"}
            </h3>

            <div class="mt-1 flex items-center gap-1">
              <For each={[1, 2, 3, 4, 5]}>
                {(i) => (
                  <Star
                    size={16}
                    class={
                      i <= 4
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-muted text-muted"
                    }
                    aria-hidden="true"
                  />
                )}
              </For>
              <span class="ml-1 text-sm text-muted-foreground">4.0</span>
            </div>

            <Show when={props.data.description.trim()}>
              <p class="mt-2 text-sm text-muted-foreground">
                {props.data.description}
              </p>
            </Show>

            <Show when={addressDisplay()}>
              <div class="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={14} strokeWidth={2} aria-hidden="true" />
                <span class="truncate">{addressDisplay()}</span>
              </div>
            </Show>

            <div class="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span class="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium">
                {props.data.category}
              </span>
              <Show when={sectorDisplay()}>
                <span class="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {sectorDisplay()}
                </span>
              </Show>
            </div>

            <Show when={keywordList().length > 0}>
              <div class="mt-3 flex flex-wrap items-center gap-1.5">
                <Tag
                  size={12}
                  class="text-muted-foreground"
                  aria-hidden="true"
                />
                <For each={keywordList()}>
                  {(keyword) => (
                    <span class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {keyword}
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button
          type="button"
          class="flex items-center gap-2 rounded-control border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          onClick={props.onBack}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-control bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
          onClick={props.onComplete}
          disabled={props.saving || !props.data.businessName.trim()}
        >
          {props.saving ? "Saving..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
};
