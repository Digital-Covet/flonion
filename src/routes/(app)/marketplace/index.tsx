import { createSignal, createMemo, createEffect, createResource, onCleanup, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ArrowUpDown, Search, SearchX, SlidersHorizontal, Star, ChevronLeft, ChevronRight } from "lucide-solid";
import { Menu } from "@ark-ui/solid/menu";
import PartnerCard from "~/components/marketplace/partner-card";
import { fetchPartners, PAGE_SIZE, RATING_MIN, RATING_MAX, RATING_FILTER_PRESETS } from "./data/partners";
import type { Partner, PartnerRaw, SortKey, RatingRange } from "~/types/marketplace";

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

export default function App() {
  const [categories, setCategories] = createSignal<string[]>([]);
  const [ratingRange, setRatingRange] = createSignal<RatingRange>({ min: RATING_MIN, max: RATING_MAX });
  const [sort, setSort] = createSignal<SortKey>("rating");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [debouncedQuery, setDebouncedQuery] = createSignal("");
  const [page, setPage] = createSignal(1);

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
      debounceTimer = setTimeout(() => setDebouncedQuery(value), 300);
    }
  };

  // Reset page to 1 whenever filters change
  createEffect(() => {
    // Read all reactive deps so this effect re-runs on any filter change
    debouncedQuery();
    categories();
    ratingRange();
    sort();
    setPage(1);
  });

  const searchParams = createMemo(() => ({
    search: debouncedQuery(),
    categories: categories(),
    ratingRange: [ratingRange().min, ratingRange().max] as [number, number],
    sort: sort(),
    page: page(),
    pageSize: PAGE_SIZE,
  }));

  const [data] = createResource(searchParams, (params) => {
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
    return (data.latest?.partners ?? []).map((raw) => mapPartner(raw, favoritedIds));
  });
  const totalCount = createMemo(() => data.latest?.totalCount ?? 0);
  const allCategories = createMemo(() => data.latest?.categories?.filter((c) => c !== "All Categories") ?? []);

  const totalPages = createMemo(() => Math.max(1, Math.ceil(totalCount() / PAGE_SIZE)));

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const activeRatingPreset = createMemo(() => {
    const { min, max } = ratingRange();
    return RATING_FILTER_PRESETS.find((p) => p.min === min && p.max === max) ?? RATING_FILTER_PRESETS[0];
  });

  const chips = createMemo(() => {
    const result: { key: string; label: string }[] = [];
    for (const c of categories()) result.push({ key: `cat:${c}`, label: `Category: ${c}` });
    const { min, max } = ratingRange();
    if (min > RATING_MIN || max < RATING_MAX) {
      result.push({ key: "rating", label: `Rating: ${min.toFixed(1)} - ${max.toFixed(1)}` });
    }
    return result;
  });

  const removeChip = (key: string) => {
    if (key.startsWith("cat:")) toggleCategory(key.slice(4));
    else if (key === "rating") setRatingRange({ min: RATING_MIN, max: RATING_MAX });
  };

  const clearAll = () => {
    setCategories([]);
    setRatingRange({ min: RATING_MIN, max: RATING_MAX });
  };

  const showEmptyState = () => !data.loading && partners().length === 0;

  return (
    <div class="flex min-h-screen flex-col bg-background text-foreground">

      <main class="flex flex-1">
        {/* Main content area */}
        <div class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 lg:short:p-6">
          <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div class="mb-1 flex items-center gap-2">
                <h1 class="text-foreground">Partners</h1>
              </div>
              <p class="text-sm text-muted-foreground" role="status" aria-live="polite">
                Showing <span class="font-semibold text-foreground">{partners().length}</span> of{" "}
                {totalCount()} partners
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              {/* Category filter menu */}
              <Menu.Root closeOnSelect={false}>
                <Menu.Trigger
                  aria-label="Filter by category"
                  class="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <SlidersHorizontal class="h-4 w-4" />
                  Category
                  <Show when={categories().length > 0}>
                    <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                      {categories().length}
                    </span>
                  </Show>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content class="z-50 min-w-44 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <For each={allCategories()}>
                      {(cat) => (
                        <Menu.Item
                          value={cat}
                          closeOnSelect={false}
                          onSelect={() => toggleCategory(cat)}
                          class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                        >
                          {cat}
                          {categories().includes(cat) && (
                            <span class="ml-auto text-primary">&#10003;</span>
                          )}
                        </Menu.Item>
                      )}
                    </For>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>

              {/* Rating filter menu */}
              <Menu.Root>
                <Menu.Trigger
                  aria-label="Filter by rating"
                  class="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Star class="h-4 w-4 text-orange" />
                  Rating: {activeRatingPreset().label}
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content class="z-50 min-w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <For each={RATING_FILTER_PRESETS}>
                      {(preset) => (
                        <Menu.Item
                          value={preset.label}
                          onSelect={() => setRatingRange({ min: preset.min, max: preset.max })}
                          class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                        >
                          {preset.label}
                          {activeRatingPreset().label === preset.label && (
                            <span class="ml-auto text-primary">&#10003;</span>
                          )}
                        </Menu.Item>
                      )}
                    </For>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>

              {/* Sort */}
              <Menu.Root>
                <Menu.Trigger
                  aria-label="Sort partners"
                  class="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ArrowUpDown class="h-4 w-4" />
                  {SORT_LABELS[sort()]}
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content class="z-50 min-w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <For each={SORT_OPTIONS}>
                      {(option) => (
                        <Menu.Item
                          value={option.value}
                          class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                          onSelect={() => setSort(option.value)}
                        >
                          {option.label}
                          {sort() === option.value && (
                            <span class="ml-auto text-primary">&#10003;</span>
                          )}
                        </Menu.Item>
                      )}
                    </For>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            </div>
          </div>

          {/* Search bar */}
          <div class="relative mb-6">
            <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              placeholder="Search partners, services, locations..."
              aria-label="Search partners"
              class="h-10 w-full rounded-lg border border-border bg-muted pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {/* Mobile category tabs */}
          <Show when={allCategories().length > 0}>
            <div class="mb-6 lg:hidden">
              <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setCategories([])}
                  classList={{
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors":
                      true,
                    "border-primary bg-primary/10 text-primary": categories().length === 0,
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
                      classList={{
                        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors":
                          true,
                        "border-primary bg-primary/10 text-primary": categories().includes(cat),
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

          {/* Grid or empty state */}
          <Show
            when={partners().length > 0}
            fallback={
              <Show when={showEmptyState()}>
                <div class="flex flex-col items-center justify-center py-24 text-center">
                  <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <SearchX class="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 class="mb-2 font-heading text-xl font-bold text-foreground">
                    No partners found
                  </h3>
                  <p class="mb-6 max-w-xs text-sm text-muted-foreground">
                    Try adjusting your search or clearing a few filters to see more results.
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    class="cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                  >
                    Clear all filters
                  </button>
                </div>
              </Show>
            }
          >
            <div
              classList={{
                "grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4": true,
                "opacity-60 transition-opacity": data.loading,
              }}
            >
              <For each={partners()}>
                {(partner, index) => (
                  <PartnerCard partner={partner} index={index()} />
                )}
              </For>
            </div>
          </Show>

          {/* Pagination */}
          <Show when={totalPages() > 1}>
            <nav class="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
              <button
                type="button"
                disabled={page() <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                class="flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft class="h-4 w-4" />
                Prev
              </button>
              <span class="text-sm text-muted-foreground">
                Page {page()} of {totalPages()}
              </span>
              <button
                type="button"
                disabled={page() >= totalPages()}
                onClick={() => setPage((p) => Math.min(totalPages(), p + 1))}
                class="flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight class="h-4 w-4" />
              </button>
            </nav>
          </Show>
        </div>
      </main>
    </div>
  );
}
