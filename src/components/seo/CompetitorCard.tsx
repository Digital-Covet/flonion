import MapPin from "lucide-solid/icons/map-pin";
import Star from "lucide-solid/icons/star";
import Users from "lucide-solid/icons/users";
import { type Component, For } from "solid-js";
import { DataTable } from "~/components/ui/table";
import { scoreColor } from "~/features/seo/seo-data";
import type { Competitor } from "~/features/seo/seo-types";

interface CompetitorCardProps {
  competitors: Competitor[];
}

function Stars(props: { rating: number }) {
  return (
    <span class="inline-flex items-center gap-0.5" aria-hidden="true">
      <For each={[1, 2, 3, 4, 5]}>
        {(i) => (
          <Star
            size={12}
            class={
              i <= Math.round(props.rating)
                ? "fill-star text-star"
                : "text-border"
            }
          />
        )}
      </For>
    </span>
  );
}

function CompetitorMobileCard(props: { competitor: Competitor }) {
  const c = () => props.competitor;
  return (
    <div class="grid gap-2">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="font-medium text-foreground">{c().name}</p>
          <p class="tnum mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} aria-hidden="true" />
            {c().distance} away
          </p>
        </div>
        <span
          class="tnum rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          title={`Profile completeness ${c().profileCompleteness} percent`}
        >
          {c().profileCompleteness}%
        </span>
      </div>
      <p class="tnum flex items-center gap-1.5 text-sm">
        <Stars rating={c().rating} />
        <span class="sr-only">Rated</span>
        <span class="font-medium text-foreground">{c().rating}</span>
        <span class="text-muted-foreground">({c().reviewCount} reviews)</span>
      </p>
      <div
        class="h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${c().name} profile completeness ${c().profileCompleteness} percent`}
      >
        <div
          class={`h-full rounded-full ${scoreColor(c().profileCompleteness)}`}
          style={{ width: `${c().profileCompleteness}%` }}
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <For each={c().topCategories}>
          {(cat) => (
            <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {cat}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

/**
 * DS §6 Local SEO: competitor table (rating, reviews, completeness,
 * distance). Horizontally scrolls in its container; cards below `md`.
 */
const CompetitorCard: Component<CompetitorCardProps> = (props) => (
  <div class="rounded-card border border-border bg-card p-5 shadow-sm">
    <div class="mb-4 flex items-center gap-3">
      <div class="grid size-10 place-items-center rounded-control bg-warning-muted text-warning">
        <Users size={20} aria-hidden="true" />
      </div>
      <div>
        <h3 class="font-heading text-lg font-medium text-foreground">Local competitors</h3>
        <p class="text-xs text-muted-foreground">
          Nearby businesses in your category
        </p>
      </div>
    </div>
    <DataTable
      caption="Local competitors with rating, reviews, profile completeness, and distance"
      columns={[
        {
          header: "Business",
          render: (c) => (
            <div>
              <p class="font-medium text-foreground">{c.name}</p>
              <p class="mt-0.5 flex flex-wrap gap-1">
                {c.topCategories.map((cat) => (
                  <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {cat}
                  </span>
                ))}
              </p>
            </div>
          ),
        },
        {
          header: "Rating",
          render: (c) => (
            <span class="tnum inline-flex items-center gap-1.5 text-foreground">
              <Stars rating={c.rating} />
              <span class="sr-only">Rated</span>
              <strong class="font-medium">{c.rating}</strong>
            </span>
          ),
        },
        {
          header: "Reviews",
          numeric: true,
          render: (c) => <span class="tnum">{c.reviewCount}</span>,
        },
        {
          header: "Completeness",
          numeric: true,
          render: (c) => (
            <span class="tnum inline-flex items-center gap-2">
              <span
                class="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-muted align-middle"
                role="img"
                aria-label={`Profile completeness ${c.profileCompleteness} percent`}
              >
                <span
                  class={`block h-full rounded-full ${scoreColor(c.profileCompleteness)}`}
                  style={{ width: `${c.profileCompleteness}%` }}
                />
              </span>
              {c.profileCompleteness}%
            </span>
          ),
        },
        {
          header: "Distance",
          numeric: true,
          render: (c) => (
            <span class="tnum inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden="true" />
              {c.distance}
            </span>
          ),
        },
      ]}
      rows={props.competitors}
      rowKey={(c) => c.id}
      renderCard={(c) => <CompetitorMobileCard competitor={c} />}
      class="[&_>div:first-child]:hidden md:[&_>div:first-child]:block"
    />
  </div>
);

export default CompetitorCard;
