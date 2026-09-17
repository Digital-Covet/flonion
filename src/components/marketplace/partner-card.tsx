import { A } from "@solidjs/router";
import { CalendarDays, MapPin } from "lucide-solid";
import Heart from "lucide-solid/icons/heart";
import Phone from "lucide-solid/icons/phone";
import { createSignal, For, Show } from "solid-js";
import { Badge, StarRating } from "~/components/marketplace/portfolio";
import { ButtonLink } from "~/components/ui/button";
import { notify } from "~/components/ui/toast";
import type { Partner } from "~/types/marketplace";

interface PartnerCardProps {
  partner: Partner;
  index: number;
}

// DS §2: icon buttons are true 44px targets with a 2px primary focus outline.
// DS §6: favourite toggle exposes aria-pressed; rating pairs stars + number.
const ICON_BUTTON =
  "flex size-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors duration-180 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

export default function PartnerCard(props: PartnerCardProps) {
  const [isFavorited, setIsFavorited] = createSignal(props.partner.isFavorited);

  // Optimistic toggle with rollback — instant feedback within the INP budget.
  async function toggleFavorite(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFavorited();
    setIsFavorited(next);
    try {
      const res = await fetch("/api/marketplace/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: props.partner.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.favorited !== "boolean") {
        throw new Error("favorite failed");
      }
      setIsFavorited(data.favorited);
      notify(
        "success",
        data.favorited ? "Saved to favorites" : "Removed from favorites",
      );
    } catch {
      setIsFavorited(!next);
      notify("error", "Couldn't update favorites", "Please try again.");
    }
  }

  function handleCall(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (props.partner.phone) {
      window.location.href = `tel:${props.partner.phone}`;
    }
  }

  const profileHref = () =>
    `/company/${props.partner.username ?? props.partner.id}`;
  // Honors the partner's CTA model: book → booking page, else profile.
  const ctaHref = () =>
    props.partner.cta === "book"
      ? `/company/${props.partner.username ?? props.partner.id}/bookings`
      : profileHref();
  const ctaLabel = () =>
    props.partner.cta === "book" ? "Book a Meeting" : "View Profile";

  // No nested interactives: the card is an article; the logo/title are the
  // profile link and the icon buttons + CTA sit outside it.
  return (
    <article
      class="e1-enter group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm"
      style={{ "animation-delay": `${Math.min(props.index, 8) * 60}ms` }}
    >
      {/* Header: avatar + actions */}
      <div class="relative flex h-44 items-center justify-center border-b border-border bg-muted p-6">
        <Show when={props.partner.isNew}>
          <span class="absolute left-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            New
          </span>
        </Show>
        <div class="absolute right-4 top-4 flex gap-2">
          <Show when={props.partner.phone}>
            <button
              type="button"
              onClick={handleCall}
              aria-label={`Call ${props.partner.name}`}
              class={ICON_BUTTON}
            >
              <Phone class="size-4" aria-hidden="true" />
            </button>
          </Show>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={
              isFavorited() ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={isFavorited()}
            class={ICON_BUTTON}
          >
            <Heart
              class="size-4 transition-colors duration-180 motion-reduce:transition-none"
              classList={{
                "fill-destructive text-destructive": isFavorited(),
                "text-muted-foreground": !isFavorited(),
              }}
              aria-hidden="true"
            />
          </button>
        </div>
        <A
          href={profileHref()}
          aria-label={`View ${props.partner.name}`}
          class="relative flex size-20 items-center justify-center overflow-hidden rounded-card bg-card font-heading text-3xl font-semibold text-primary shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Show when={props.partner.logo} fallback={props.partner.initial}>
            <img
              class="h-full w-full object-cover"
              src={props.partner.logo!}
              alt={`${props.partner.name} logo`}
              loading="lazy"
            />
          </Show>
        </A>
      </div>

      {/* Body — DS §2 medium density: 20px card padding. */}
      <div class="flex flex-1 flex-col p-5">
        <p class="tnum mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
          {props.partner.category}
        </p>
        <h3 class="mb-1 truncate font-heading text-lg font-medium text-foreground">
          <A
            href={profileHref()}
            class="rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:text-primary"
          >
            {props.partner.name}
          </A>
        </h3>

        {/* DS §2: rating always pairs stars with the number. */}
        <div class="mb-3 flex items-center gap-1.5">
          <StarRating value={props.partner.rating} />
          <span class="tnum text-xs text-muted-foreground">
            {props.partner.rating.toFixed(1)} ({props.partner.reviews}{" "}
            {props.partner.reviews === 1 ? "review" : "reviews"})
          </span>
        </div>

        <Show when={props.partner.location}>
          <div class="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
            <span class="truncate">{props.partner.location}</span>
          </div>
        </Show>

        <p class="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {props.partner.description || "No description available."}
        </p>

        <Show when={props.partner.tags.length > 0}>
          <div class="mb-4 flex flex-wrap gap-1.5">
            <For each={props.partner.tags.slice(0, 3)}>
              {(tag) => <Badge>{tag}</Badge>}
            </For>
          </div>
        </Show>

        <div class="mt-auto pt-2">
          <ButtonLink href={ctaHref()} class="w-full">
            <CalendarDays class="mr-2 size-4" aria-hidden="true" />
            {ctaLabel()}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
