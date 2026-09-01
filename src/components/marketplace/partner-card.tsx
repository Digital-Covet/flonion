import { For, Show, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { CalendarDays, MapPin } from "lucide-solid";
import Phone from "lucide-solid/icons/phone";
import Heart from "lucide-solid/icons/heart";
import { StarRating } from "~/components/marketplace/portfolio";
import { Badge } from "~/components/marketplace/portfolio";
import { Button } from "~/components/marketplace/portfolio";
import type { Partner } from "~/types/marketplace";

interface PartnerCardProps {
  partner: Partner;
  index: number;
}

export default function PartnerCard(props: PartnerCardProps) {
  const [isFavorited, setIsFavorited] = createSignal(props.partner.isFavorited);

  async function toggleFavorite(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch("/api/marketplace/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: props.partner.id }),
      });
      const data = await res.json();
      if (typeof data.favorited === "boolean") {
        setIsFavorited(data.favorited);
      }
    } catch {
      // Optimistic state is reverted; ignore network errors
    }
  }

  function handleCall(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (props.partner.phone) {
      window.location.href = `tel:${props.partner.phone}`;
    }
  }

  return (
    <A
      href={`/company/${props.partner.username ?? props.partner.id}`}
      class="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 animate-[fade-in-up_0.5s_ease-out_both] hover:-translate-y-1 hover:shadow-md no-underline"
      style={{ "animation-delay": `${Math.min(props.index, 8) * 60}ms` }}
    >
      {/* Header: avatar + category */}
      <div class="relative flex h-48 items-center justify-center border-b border-border bg-muted p-6 short:h-40">
        <Show when={props.partner.isNew}>
          <span class="absolute left-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
            NEW
          </span>
        </Show>
        <div class="absolute right-4 top-4 flex gap-1.5">
          <Show when={props.partner.phone}>
            <button
              type="button"
              onClick={handleCall}
              aria-label={`Call ${props.partner.name}`}
              class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
            >
              <Phone class="h-4 w-4" />
            </button>
          </Show>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={isFavorited() ? "Remove from favorites" : "Add to favorites"}
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background"
          >
            <Heart
              class="h-4 w-4 transition-colors"
              classList={{
                "fill-red-500 text-red-500": isFavorited(),
                "text-muted-foreground": !isFavorited(),
              }}
            />
          </button>
        </div>
        <div class="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-muted font-heading text-3xl font-bold text-primary shadow-sm transition-transform duration-300 group-hover:scale-110">
          <Show
            when={props.partner.logo}
            fallback={props.partner.initial}
          >
            <img
              class="h-full w-full object-cover"
              src={props.partner.logo!}
              alt={`${props.partner.name} logo`}
            />
          </Show>
        </div>
      </div>

      {/* Body */}
      <div class="flex flex-1 flex-col p-4">
        {/* Title + rating */}
        <h3 class="mb-1 truncate font-heading text-base font-bold text-foreground">
          {props.partner.name}
        </h3>

        <div class="mb-3 flex items-center gap-1.5">
          <StarRating value={props.partner.rating} />
          <span class="text-xs text-muted-foreground">
            {props.partner.rating.toFixed(1)} ({props.partner.reviews} reviews)
          </span>
        </div>

        {/* Location */}
        <Show when={props.partner.location}>
          <div class="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">{props.partner.location}</span>
          </div>
        </Show>

        {/* Description */}
        <p class="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {props.partner.description || "No description available."}
        </p>

        {/* Tags */}
        <Show when={props.partner.tags.length > 0}>
          <div class="mb-4 flex flex-wrap gap-1.5">
            <For each={props.partner.tags.slice(0, 4)}>
              {(tag) => <Badge>{tag}</Badge>}
            </For>
          </div>
        </Show>

        {/* CTA */}
        <div class="mt-auto pt-2">
          <Button variant="primary" class="w-full">
            <CalendarDays class="mr-2 h-4 w-4" />
            Book a Meeting
          </Button>
        </div>
      </div>
    </A>
  );
}
