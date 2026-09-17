import { Menu } from "@ark-ui/solid/menu";
import { useSearchParams } from "@solidjs/router";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-solid";
import SearchX from "lucide-solid/icons/search-x";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import PartnerCard from "~/components/marketplace/partner-card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton, WidgetError } from "~/components/ui/skeleton";
import type {
  Partner,
  PartnerRaw,
  RatingRange,
  SortKey,
} from "~/types/marketplace";
import {
  fetchPartners,
  PAGE_SIZE,
  RATING_FILTER_PRESETS,
  RATING_MAX,
  RATING_MIN,
} from "./data/partners";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "Rating" },
  { value: "relevance", label: "Relevance" },
  { value: "alpha-asc", label: "A to Z" },
  { value: "alpha-desc", label: "Z to A" },
];

const SORT_LABELS: Record<SortKey, string> = {
  rating: "Rating",
  relevance: "Relevance",
  "alpha-asc": "A to Z",
  "alpha-desc": "Z to A",
};

const VALID_SORTS: SortKey[] = [
  "rating",
  "relevance",
  "alpha-asc",
  "alpha-desc",
];

function mapPartner(raw: PartnerRaw, favoritedIds: Set<string>): Partner {
  return {
    id: raw.id,
    name: raw.name,
    initial: raw.initial,
    category: raw.category ?? "General",
    location: raw.location,
    rating: raw.rating,
    reviews: raw.reviewCount,
    description: raw.description,
    logo: raw.logo,
    username: raw.username,
    tags: raw.tags ?? [],
    isNew: raw.isNew,
    cta: raw.buttonType === "meeting" ? "book" : "shortlist",
    phone: raw.phone ?? null,
    isFavorited: favoritedIds.has(raw.id),
  };
}

// DS §2: controls share one shape — 44px min-height, 8px radius, 2px primary
// focus outline with 2px offset (base :focus-visible in app.css covers the
// outline; this keeps border + text consistent).
const FILTER_BUTTON =
  "flex min-h-11 h-11 cursor-pointer items-center gap-2 rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors duration-180 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

const MENU_CONTENT =
  "z-50 min-w-44 rounded-card border border-border bg-card p-1 shadow-md";

const MENU_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-sm outline-none transition-colors duration-180 hover:bg-muted data-[highlighted]:bg-muted motion-reduce:transition-none";

export default function Marketplace() {
  // DS §6: search + category + rating + sort + pagination are URL-synced for
  // shareability and back-button support.
  const [urlParams, setUrlParams] = useSearchParams();

  const param = (key: string): string => {
    const v = urlParams[key];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };

  const initialCategories = () =>
    param("cat")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

  const initialRating = (): RatingRange => {
    const min = Number(param("min"));
    const max = Number(param("max"));
    return {
      min: Number.isFinite(min) && min >= RATING_MIN ? min : RATING_MIN,
      max: Number.isFinite(max) && max <= RATING_MAX ? max : RATING_MAX,
    };
  };

  const initialSort = (): SortKey => {
    const s = param("sort");
    return (VALID_SORTS as string[]).includes(s) ? (s as SortKey) : "rating";
  };

  const initialPage = (): number => {
    const p = Number(param("page"));
    return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
  };

  const [categories, setCategories] = createSignal<string[]>(
    initialCategories(),
  );
  const [ratingRange, setRatingRange] = createSignal<RatingRange>(
    initialRating(),
  );
  const [sort, setSort] = createSignal<SortKey>(initialSort());
  const [searchQuery, setSearchQuery] = createSignal(param("q"));
  const [debouncedQuery, setDebouncedQuery] = createSignal(param("q"));
  const [page, setPage] = createSignal(initialPage());

  let debounceTimer: ReturnType<typeof setTimeout>;
  let abortController: AbortController | null = null;
  onCleanup(() => {
    clearTimeout(debounceTimer);
    abortController?.abort();
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceTimer);
    if (value === "") {
      setDebouncedQuery("");
    } else {
      debounceTimer = setTimeout(() => setDebouncedQuery(value), 250);
    }
  };

  // Reset to page 1 on filter change (skipped on first run so ?page=
  // deep links survive the initial mount).
  let firstFilterRun = true;
  createEffect(() => {
    debouncedQuery();
    categories();
    ratingRange();
    sort();
    if (firstFilterRun) {
      firstFilterRun = false;
      return;
    }
    setPage(1);
  });

  // Mirror filter state into the URL (replace, not push — no history spam).
  createEffect(() => {
    const { min, max } = ratingRange();
    setUrlParams(
      {
        q: debouncedQuery() || undefined,
        cat: categories().length > 0 ? categories().join(",") : undefined,
        min: min > RATING_MIN ? String(min) : undefined,
        max: max < RATING_MAX ? String(max) : undefined,
        sort: sort() !== "rating" ? sort() : undefined,
        page: page() > 1 ? String(page()) : undefined,
      },
      { replace: true },
    );
  });

  const searchParams = createMemo(() => ({
    search: debouncedQuery(),
    categories: categories(),
    ratingRange: [ratingRange().min, ratingRange().max] as [number, number],
    sort: sort(),
    page: page(),
    pageSize: PAGE_SIZE,
  }));

  const [data, { refetch }] = createResource(searchParams, (params) => {
    abortController?.abort();
    abortController = new AbortController();
    return fetchPartners(params, abortController.signal);
  });

  const [favoritesData] = createResource(async () => {
    if (isServer) return [];
    const res = await fetch("/api/marketplace/favorites");
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.favorites) ? json.favorites : [];
  });

  const partners = createMemo(() => {
    const favoritedIds = new Set<string>(favoritesData() ?? []);
    return (data.latest?.partners ?? []).map((raw) =>
      mapPartner(raw, favoritedIds),
    );
  });
  const totalCount = createMemo(() => data.latest?.totalCount ?? 0);
  const allCategories = createMemo(
    () => data.latest?.categories?.filter((c) => c !== "All Categories") ?? [],
  );

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(totalCount() / PAGE_SIZE)),
  );

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const activeRatingPreset = createMemo(() => {
    const { min, max } = ratingRange();
    return (
      RATING_FILTER_PRESETS.find((p) => p.min === min && p.max === max) ??
      RATING_FILTER_PRESETS[0]
    );
  });

  const hasActiveFilters = createMemo(
    () =>
      debouncedQuery() !== "" ||
      categories().length > 0 ||
      ratingRange().min !== RATING_MIN ||
      ratingRange().max !== RATING_MAX ||
      sort() !== "rating",
  );

  const clearAll = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setCategories([]);
    setRatingRange({ min: RATING_MIN, max: RATING_MAX });
    setSort("rating");
    setPage(1);
  };

  const loadError = () => data.error;
  const showEmptyState = () =>
    !data.loading && !loadError() && partners().length === 0;

  return (
    <main class="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 lg:p-8">
      {/* Header — DS §6: purpose + live result count (tabular numerals). */}
      <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="font-heading text-foreground">Marketplace</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Find and favourite partners for your next collaboration.
          </p>
          <p
            class="tnum mt-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Showing{" "}
            <span class="font-medium text-foreground">
              {partners().length}
            </span>{" "}
            of <span class="font-medium text-foreground">{totalCount()}</span>{" "}
            partners
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          <Menu.Root closeOnSelect={false}>
            <Menu.Trigger aria-label="Filter by category" class={FILTER_BUTTON}>
              <SlidersHorizontal class="size-4" aria-hidden="true" />
              Category
              <Show when={categories().length > 0}>
                <span class="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {categories().length}
                </span>
              </Show>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content class={MENU_CONTENT}>
                <For each={allCategories()}>
                  {(cat) => (
                    <Menu.Item
                      value={cat}
                      closeOnSelect={false}
                      onSelect={() => toggleCategory(cat)}
                      class={MENU_ITEM}
                    >
                      {cat}
                      {categories().includes(cat) && (
                        <span class="ml-auto text-primary" aria-hidden="true">
                          &#10003;
                        </span>
                      )}
                    </Menu.Item>
                  )}
                </For>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>

          {/* Rating filter */}
          <Menu.Root>
            <Menu.Trigger aria-label="Filter by rating" class={FILTER_BUTTON}>
              <Star class="size-4 text-star fill-star" aria-hidden="true" />
              Rating: {activeRatingPreset().label}
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content class={MENU_CONTENT}>
                <For each={RATING_FILTER_PRESETS}>
                  {(preset) => (
                    <Menu.Item
                      value={preset.label}
                      onSelect={() =>
                        setRatingRange({ min: preset.min, max: preset.max })
                      }
                      class={MENU_ITEM}
                    >
                      {preset.label}
                      {activeRatingPreset().label === preset.label && (
                        <span class="ml-auto text-primary" aria-hidden="true">
                          &#10003;
                        </span>
                      )}
                    </Menu.Item>
                  )}
                </For>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>

          {/* Sort */}
          <Menu.Root>
            <Menu.Trigger aria-label="Sort partners" class={FILTER_BUTTON}>
              <ArrowUpDown class="size-4" aria-hidden="true" />
              {SORT_LABELS[sort()]}
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content class={MENU_CONTENT}>
                <For each={SORT_OPTIONS}>
                  {(option) => (
                    <Menu.Item
                      value={option.value}
                      class={MENU_ITEM}
                      onSelect={() => setSort(option.value)}
                    >
                      {option.label}
                      {sort() === option.value && (
                        <span class="ml-auto text-primary" aria-hidden="true">
                          &#10003;
                        </span>
                      )}
                    </Menu.Item>
                  )}
                </For>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </div>
      </div>

      {/* Search — 44px control, 16px text (no iOS zoom), visible focus. */}
      <search class="relative mb-4 block">
        <Search
          class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery()}
          onInput={(e) => handleSearch(e.currentTarget.value)}
          placeholder="Search partners, services, locations..."
          aria-label="Search partners"
          class="h-11 min-h-11 w-full rounded-control border border-border bg-card pl-10 pr-4 text-base text-foreground outline-none transition-colors duration-180 placeholder:text-muted-foreground focus:border-primary motion-reduce:transition-none"
        />
      </search>

      {/* Mobile category tabs — tap/keyboard alternative, below lg. */}
      <Show when={allCategories().length > 0}>
        <div class="mb-6 lg:hidden">
          <div class="flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setCategories([])}
              aria-pressed={categories().length === 0}
              classList={{
                "shrink-0 rounded-full border px-4 py-1.5 min-h-11 text-sm font-medium transition-colors duration-180 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary": true,
                "border-primary bg-positive-muted text-primary":
                  categories().length === 0,
                "border-border text-muted-foreground hover:border-primary hover:text-primary":
                  categories().length > 0,
              }}
            >
              All
            </button>
            <For each={allCategories()}>
              {(cat) => (
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={categories().includes(cat)}
                  classList={{
                    "shrink-0 rounded-full border px-4 py-1.5 min-h-11 text-sm font-medium transition-colors duration-180 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary": true,
                    "border-primary bg-positive-muted text-primary":
                      categories().includes(cat),
                    "border-border text-muted-foreground hover:border-primary hover:text-primary":
                      !categories().includes(cat),
                  }}
                >
                  {cat}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Active-filter reset */}
      <Show when={hasActiveFilters() && !showEmptyState()}>
        <div class="mb-4">
          <button
            type="button"
            onClick={clearAll}
            class="min-h-11 rounded-control px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Clear filters
          </button>
        </div>
      </Show>

      {/* Error — per-widget, stale results stay visible underneath. */}
      <Show when={loadError() && partners().length === 0}>
        <WidgetError
          message="Could not load partners. Check your connection and retry."
          onRetry={() => refetch()}
          retryLabel="Retry"
        />
      </Show>
      <Show when={loadError() && partners().length > 0}>
        <div class="mb-4">
          <WidgetError
            message="Couldn't refresh results — showing cached partners."
            onRetry={() => refetch()}
            retryLabel="Retry"
          />
        </div>
      </Show>

      {/* Loading — layout-matched skeletons hold CLS ≤ 0.1. */}
      <Show when={data.loading && partners().length === 0 && !loadError()}>
        <div
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden="true"
        >
          <For each={Array.from({ length: 6 })}>
            {() => (
              <div class="overflow-hidden rounded-card border border-border bg-card">
                <Skeleton class="h-44 w-full rounded-none" />
                <div class="grid gap-2 p-5">
                  <Skeleton class="h-5 w-2/3" />
                  <Skeleton class="h-4 w-1/3" />
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-11 w-full" />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* DS §6: card grid 3 / 2 / 1 columns, or guided empty state. */}
      <Show
        when={partners().length > 0}
        fallback={
          <Show when={showEmptyState()}>
            <EmptyState
              icon={SearchX}
              title="No partners match"
              description="Try adjusting your search or clearing a few filters to see more results."
              primaryLabel="Clear filters"
              onPrimary={clearAll}
            />
          </Show>
        }
      >
        <div
          classList={{
            "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3": true,
            "opacity-60 transition-opacity duration-180 motion-reduce:transition-none":
              data.loading,
          }}
        >
          <For each={partners()}>
            {(partner, index) => (
              <PartnerCard partner={partner} index={index()} />
            )}
          </For>
        </div>
      </Show>

      {/* Pagination — 44px controls, tabular page count. */}
      <Show when={totalPages() > 1}>
        <nav
          class="mt-8 flex items-center justify-center gap-4"
          aria-label="Pagination"
        >
          <button
            type="button"
            disabled={page() <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            class="flex h-11 min-h-11 cursor-pointer items-center gap-1 rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors duration-180 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
            Prev
          </button>
          <span class="tnum text-sm text-muted-foreground" aria-live="polite">
            Page {page()} of {totalPages()}
          </span>
          <button
            type="button"
            disabled={page() >= totalPages()}
            onClick={() => setPage((p) => Math.min(totalPages(), p + 1))}
            class="flex h-11 min-h-11 cursor-pointer items-center gap-1 rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors duration-180 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            Next
            <ChevronRight class="size-4" aria-hidden="true" />
          </button>
        </nav>
      </Show>
    </main>
  );
}
