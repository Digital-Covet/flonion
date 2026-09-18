import { Dialog } from "@ark-ui/solid/dialog";
import {
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
  IconHeart,
  IconHeartFilled,
  IconMapPin,
  IconSearch,
  IconX,
} from "@tabler/icons-solidjs";
import { For, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { focusRing, inputBase, labelClass } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { RatingPill } from "~/components/landing/brand";
import {
  activeFilterCount,
  type MarketplaceView,
  type Partner,
  RATING_OPTIONS,
  type RatingFilter,
  SKELETON_CARDS,
} from "~/components/marketplace/data";
import { btnSecondary, SelectField } from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";
import { SORT_OPTIONS, type SortKey } from "~/types/marketplace";

// ─── Toolbar ─────────────────────────────────────────────────────────────

/**
 * Search stays out of the filter drawer: it is the control owners reach for
 * most, and on a phone it should never be two taps away.
 */
export function SearchField(props: {
  value: string;
  onInput: (value: string) => void;
  onClear: () => void;
  class?: string;
}) {
  return (
    <div class={cn("relative flex flex-col gap-1.5", props.class)}>
      <label for="marketplace-search" class={labelClass}>
        Search partners
      </label>
      <IconSearch
        aria-hidden="true"
        class="pointer-events-none absolute bottom-3 left-3 size-5 text-text-muted"
      />
      <input
        id="marketplace-search"
        type="search"
        autocomplete="off"
        placeholder="Name, service or area"
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        class={cn(inputBase, "pr-10 pl-10")}
      />
      <Show when={props.value}>
        <button
          type="button"
          onClick={() => props.onClear()}
          class={cn(
            "absolute right-1 bottom-1 grid size-9 place-items-center rounded-sm text-text-muted hover:bg-primary-soft hover:text-text",
            focusRing,
          )}
        >
          <IconX aria-hidden="true" class="size-4" />
          <span class="sr-only">Clear search</span>
        </button>
      </Show>
    </div>
  );
}

export function SortSelect(props: {
  value: SortKey;
  onChange: (value: SortKey) => void;
  class?: string;
}) {
  return (
    <SelectField
      label="Sort by"
      options={SORT_OPTIONS}
      value={props.value}
      onChange={(v) => props.onChange((v || "rating") as SortKey)}
      class={props.class}
    />
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────

/**
 * Category and rating. Sort is deliberately not here: it isn't a filter, so
 * "Clear filters" must not reset it.
 */
export function FilterPanel(props: {
  view: MarketplaceView;
  /** Every category the API offers, in display order. */
  categories: string[];
  /** Distinguishes the sidebar's inputs from the drawer's copy of them. */
  idPrefix: string;
  onChange: (next: Partial<MarketplaceView>) => void;
  onClear: () => void;
  class?: string;
}) {
  const active = () => activeFilterCount(props.view);

  function toggleCategory(category: string, checked: boolean) {
    const next = checked
      ? [...props.view.categories, category]
      : props.view.categories.filter((c) => c !== category);
    props.onChange({ categories: next });
  }

  const rowClass =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-base text-text hover:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";

  return (
    <div class={cn("flex flex-col gap-6", props.class)}>
      <fieldset>
        <legend class="font-display text-sm font-semibold text-text">
          Category
        </legend>
        <ul class="mt-2 flex flex-col">
          <For each={props.categories}>
            {(category) => {
              const id = `${props.idPrefix}-cat-${category
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <li>
                  <label for={id} class={rowClass}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={props.view.categories.includes(category)}
                      onChange={(e) =>
                        toggleCategory(category, e.currentTarget.checked)
                      }
                      class="size-4 shrink-0 accent-[var(--primary)] outline-none"
                    />
                    <span class="min-w-0 flex-1 truncate">{category}</span>
                  </label>
                </li>
              );
            }}
          </For>
        </ul>
      </fieldset>

      <fieldset>
        <legend class="font-display text-sm font-semibold text-text">
          Minimum rating
        </legend>
        <ul class="mt-2 flex flex-col">
          <For each={RATING_OPTIONS}>
            {(option) => {
              const id = `${props.idPrefix}-rating-${option.value}`;
              return (
                <li>
                  <label for={id} class={rowClass}>
                    <input
                      id={id}
                      type="radio"
                      name={`${props.idPrefix}-rating`}
                      value={option.value}
                      checked={props.view.rating === option.value}
                      onChange={() =>
                        props.onChange({ rating: option.value as RatingFilter })
                      }
                      class="size-4 shrink-0 accent-[var(--primary)] outline-none"
                    />
                    <span class="min-w-0 flex-1">{option.label}</span>
                  </label>
                </li>
              );
            }}
          </For>
        </ul>
        <p class="mt-2 px-2 text-xs text-text-muted">
          Partners with no reviews yet are always included, so new businesses
          stay findable.
        </p>
      </fieldset>

      <button
        type="button"
        onClick={() => props.onClear()}
        disabled={active() === 0}
        class={cn(
          btnSecondary,
          "px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        )}
      >
        <IconFilterOff aria-hidden="true" class="size-4" />
        Clear filters
      </button>
    </div>
  );
}

/** Opens the filter panel below `lg`, where the sidebar doesn't fit. */
export function FiltersButton(props: {
  count: number;
  onClick: () => void;
  class?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class={cn(btnSecondary, "px-4 text-base", props.class)}
    >
      <IconFilter aria-hidden="true" class="size-5" />
      Filters
      <Show when={props.count > 0}>
        <span class="rounded-full bg-primary px-1.5 font-mono text-xs tabular-nums text-primary-foreground">
          {props.count}
        </span>
        <span class="sr-only"> active</span>
      </Show>
    </button>
  );
}

/** Bottom sheet on phones: same panel, same state, no second source of truth. */
export function FiltersDrawer(props: {
  open: boolean;
  onClose: () => void;
  /** e.g. "Show 24 partners" — updates as filters change. */
  applyLabel: string;
  children: JSX.Element;
}) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0 lg:hidden" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end lg:hidden">
          <Dialog.Content class="flex max-h-[85dvh] w-full flex-col rounded-t-xl bg-surface text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:slide-in-from-bottom-8">
            <div class="flex items-center gap-3 border-b border-border py-2 pr-2 pl-4">
              <Dialog.Title class="flex-1 font-display text-lg font-semibold">
                Filters
              </Dialog.Title>
              <Dialog.CloseTrigger
                aria-label="Close filters"
                class={cn(
                  "grid size-11 place-items-center rounded-md text-text-muted hover:bg-background",
                  focusRing,
                )}
              >
                <IconX aria-hidden="true" class="size-5" />
              </Dialog.CloseTrigger>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {props.children}
            </div>

            <div class="border-t border-border p-4">
              <Dialog.CloseTrigger
                class={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 font-display text-base font-semibold text-primary-foreground",
                  focusRing,
                )}
              >
                {props.applyLabel}
              </Dialog.CloseTrigger>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Partner card ────────────────────────────────────────────────────────

function Logo(props: { partner: Partner }) {
  return (
    <Show
      when={props.partner.logo}
      fallback={
        <span
          aria-hidden="true"
          class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-soft font-display text-lg font-semibold text-primary"
        >
          {props.partner.initial}
        </span>
      }
    >
      {(src) => (
        <img
          src={src()}
          alt=""
          width="48"
          height="48"
          loading="lazy"
          decoding="async"
          class="size-12 shrink-0 rounded-md border border-border object-cover"
        />
      )}
    </Show>
  );
}

const chipClass =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

/** Tags beyond this are counted rather than listed, so cards stay one height. */
const VISIBLE_TAGS = 3;

export function PartnerCard(props: {
  partner: Partner;
  favorite: boolean;
  /** A toggle in flight; the heart can't be double-sent. */
  pending: boolean;
  onToggleFavorite: (partner: Partner) => void;
}) {
  const p = () => props.partner;
  const href = () => (p().username ? `/company/${p().username}` : null);
  const rated = () => p().reviewCount > 0 || p().rating > 0;
  const extraTags = () => Math.max(0, p().tags.length - VISIBLE_TAGS);

  return (
    <article class="flex h-full flex-col rounded-lg border border-border bg-surface p-4 transition-shadow duration-[var(--duration-fast)] hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
      <div class="flex items-start gap-3">
        <Logo partner={p()} />

        <div class="min-w-0 flex-1">
          <h3 class="font-display text-lg leading-tight font-semibold text-text">
            <Show when={href()} fallback={<span>{p().name}</span>}>
              {(to) => (
                <a
                  href={to()}
                  class={cn(
                    "rounded-sm underline-offset-4 hover:underline",
                    focusRing,
                  )}
                >
                  {p().name}
                </a>
              )}
            </Show>
          </h3>
          <Show when={p().location}>
            {(location) => (
              <p class="mt-1 flex items-center gap-1 text-sm text-text-muted">
                <IconMapPin aria-hidden="true" class="size-4 shrink-0" />
                <span class="truncate">{location()}</span>
              </p>
            )}
          </Show>
        </div>

        <button
          type="button"
          aria-pressed={props.favorite}
          disabled={props.pending}
          onClick={() => props.onToggleFavorite(p())}
          class={cn(
            "-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-md transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft disabled:cursor-progress",
            props.favorite ? "text-primary" : "text-text-muted",
            focusRing,
          )}
        >
          <Show
            when={props.favorite}
            fallback={<IconHeart aria-hidden="true" class="size-5" />}
          >
            <IconHeartFilled aria-hidden="true" class="size-5" />
          </Show>
          <span class="sr-only">Favourite {p().name}</span>
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Show when={p().category}>
          {(category) => (
            <span class={cn(chipClass, "bg-primary-soft text-primary")}>
              {category()}
            </span>
          )}
        </Show>
        <Show when={p().isNew}>
          <span
            class={cn(chipClass, "border border-secondary/40 text-secondary")}
          >
            New this month
          </span>
        </Show>
      </div>

      <div class="mt-3">
        <Show
          when={rated()}
          fallback={<span class="text-sm text-text-muted">No reviews yet</span>}
        >
          <RatingPill
            rating={p().rating}
            count={p().reviewCount}
            class="py-0.5 text-xs"
          />
        </Show>
      </div>

      <Show when={p().description}>
        {(description) => (
          <p class="mt-3 line-clamp-2 text-sm text-pretty text-text-muted">
            {description()}
          </p>
        )}
      </Show>

      <Show when={p().tags.length > 0}>
        <ul class="mt-3 flex flex-wrap gap-1.5">
          <For each={p().tags.slice(0, VISIBLE_TAGS)}>
            {(tag) => (
              <li class={cn(chipClass, "border border-border text-text-muted")}>
                {tag}
              </li>
            )}
          </For>
          <Show when={extraTags() > 0}>
            <li class={cn(chipClass, "text-text-muted")}>
              +<span class="font-mono tabular-nums">{extraTags()}</span> more
            </li>
          </Show>
        </ul>
      </Show>

      <div class="mt-4 flex flex-1 items-end">
        <Show
          when={href()}
          fallback={
            <p class="text-sm text-text-muted">
              This partner hasn't published a profile yet.
            </p>
          }
        >
          {(to) => (
            <a href={to()} class={cn(btnSecondary, "w-full px-4 text-sm")}>
              View profile
              <span class="sr-only"> for {p().name}</span>
            </a>
          )}
        </Show>
      </div>
    </article>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────

/** Sized like a real card so the grid doesn't jump when data lands. */
function CardSkeleton() {
  return (
    <div class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div class="flex items-start gap-3">
        <Skeleton class="size-12 shrink-0 rounded-md" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-5 w-3/5" />
          <Skeleton class="h-4 w-2/5 opacity-70" />
        </div>
      </div>
      <Skeleton class="h-5 w-28 rounded-full" />
      <Skeleton class="h-6 w-32 rounded-full" />
      <Skeleton class="h-4 w-full opacity-70" />
      <Skeleton class="h-4 w-4/5 opacity-70" />
      <Skeleton class="mt-1 h-11 w-full rounded-md" />
    </div>
  );
}

export function CardGridSkeleton(props: { count?: number }) {
  return (
    <div aria-busy="true" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <span class="sr-only">Loading partners…</span>
      <For each={Array.from({ length: props.count ?? SKELETON_CARDS })}>
        {() => <CardSkeleton />}
      </For>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────

export function Pagination(props: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const stepClass = cn(
    btnSecondary,
    "px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
  );

  return (
    <nav
      aria-label="Partner pages"
      class="flex items-center justify-between gap-3"
    >
      <button
        type="button"
        disabled={props.page <= 1}
        onClick={() => props.onChange(props.page - 1)}
        class={stepClass}
      >
        <IconChevronLeft aria-hidden="true" class="size-4" />
        Previous
      </button>

      <p class="text-sm text-text-muted">
        Page <span class="font-mono tabular-nums text-text">{props.page}</span>{" "}
        of{" "}
        <span class="font-mono tabular-nums text-text">{props.pageCount}</span>
      </p>

      <button
        type="button"
        disabled={props.page >= props.pageCount}
        onClick={() => props.onChange(props.page + 1)}
        class={stepClass}
      >
        Next
        <IconChevronRight aria-hidden="true" class="size-4" />
      </button>
    </nav>
  );
}
