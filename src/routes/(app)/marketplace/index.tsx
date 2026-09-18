import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { IconBuildingStore, IconMoodSearch } from "@tabler/icons-solidjs";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { isLoading, settled } from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import {
  activeFilterCount,
  CACHE_TTL_MS,
  countLabel,
  DEFAULT_VIEW,
  freshnessLabel,
  loadFavorites,
  loadPartners,
  type MarketplaceView,
  type Partner,
  pageCount,
  toggleFavorite,
  viewFrom,
  viewParams,
} from "~/components/marketplace/data";
import {
  CardGridSkeleton,
  FilterPanel,
  FiltersButton,
  FiltersDrawer,
  Pagination,
  PartnerCard,
  SearchField,
  SortSelect,
} from "~/components/marketplace/widgets";
import { Notice } from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

/** Typing pauses this long before the URL (and the query) changes. */
const SEARCH_DEBOUNCE_MS = 300;

/** How often the "Updated …" label re-renders. */
const FRESHNESS_TICK_MS = 30_000;

export default function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const view = createMemo(() => viewFrom(params));

  // API routes need the browser's cookies, so nothing fetches during SSR.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [data, { refetch }] = createResource(
    () => ready() && view(),
    loadPartners,
  );
  const [favorites, { mutate: mutateFavorites }] = createResource(
    ready,
    loadFavorites,
  );

  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [favoriteError, setFavoriteError] = createSignal("");
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = createSignal(view().search);
  const [now, setNow] = createSignal(Date.now());

  const loaded = () => settled(data);
  const result = () => loaded()?.result;
  const partners = () => result()?.partners ?? [];
  const total = () => result()?.totalCount ?? 0;
  const favoriteIds = () => settled(favorites) ?? new Set<string>();
  const filters = () => activeFilterCount(view());
  const refreshing = () => data.state === "refreshing";

  /** Categories come from the API so the panel can never drift from the query. */
  const categories = () => result()?.categories ?? [];

  // ── Freshness. The API answers from a 60s cache, so the label only has to
  // be right to the minute.
  onMount(() => {
    const tick = setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
    onCleanup(() => clearInterval(tick));

    // Partners change while the owner is away; a refocus past the cache TTL
    // refetches, and anything sooner would be served the same rows.
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < CACHE_TTL_MS) return;
      last = Date.now();
      setNow(Date.now());
      refetch();
    };
    document.addEventListener("visibilitychange", onFocus);
    onCleanup(() => document.removeEventListener("visibilitychange", onFocus));
  });

  // Re-announce even when the text repeats, so the live region always fires.
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  // Result counts are announced on every settled load, not on every keystroke.
  createEffect(
    on(
      () => loaded(),
      (value) => {
        if (!value) return;
        const count = value.result.totalCount;
        announce(
          count === 0
            ? "No partners match these filters"
            : `${count} ${countLabel(count)} found`,
        );
      },
      { defer: true },
    ),
  );

  /** Any filter change returns to page 1; paging passes its own page. */
  function update(next: Partial<MarketplaceView>) {
    const merged: MarketplaceView = {
      ...view(),
      ...next,
      page: next.page ?? 1,
    };
    setParams(viewParams(merged), { replace: true });
  }

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(searchTimer));

  function onSearchInput(value: string) {
    setDraft(value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => update({ search: value.trim() }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function clearSearch() {
    clearTimeout(searchTimer);
    setDraft("");
    update({ search: "" });
  }

  function clearFilters() {
    clearTimeout(searchTimer);
    setDraft("");
    update({
      search: "",
      categories: [],
      rating: DEFAULT_VIEW.rating,
    });
    announce("Filters cleared");
  }

  /**
   * Optimistic: the heart fills on tap and reverts if the server disagrees,
   * because a favourite is cheap to undo and the wait is what feels broken.
   */
  async function onToggleFavorite(partner: Partner) {
    if (pending().has(partner.id)) return;
    setFavoriteError("");

    const wasFavorite = favoriteIds().has(partner.id);
    setPending((ids) => new Set(ids).add(partner.id));
    mutateFavorites((ids) => nextFavorites(ids, partner.id, !wasFavorite));

    try {
      const favorited = await toggleFavorite(partner.id);
      mutateFavorites((ids) => nextFavorites(ids, partner.id, favorited));
      announce(
        favorited
          ? `${partner.name} added to favourites`
          : `${partner.name} removed from favourites`,
      );
    } catch {
      mutateFavorites((ids) => nextFavorites(ids, partner.id, wasFavorite));
      setFavoriteError(
        `We couldn't update your favourites. ${partner.name} is unchanged.`,
      );
    } finally {
      setPending((ids) => {
        const next = new Set(ids);
        next.delete(partner.id);
        return next;
      });
    }
  }

  const filterPanel = (idPrefix: string) => (
    <FilterPanel
      idPrefix={idPrefix}
      view={view()}
      categories={categories()}
      onChange={update}
      onClear={clearFilters}
    />
  );

  const applyLabel = () =>
    loaded()
      ? `Show ${total()} ${countLabel(total())}`
      : "Show matching partners";

  return (
    <>
      <Title>Marketplace · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Marketplace
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              Local businesses you can work with — compare ratings, then open a
              profile to request a meeting.
            </p>
          </div>
          <A href="/marketplace/projects" class="shrink-0 text-sm">
            <span class="font-medium text-primary underline-offset-4 hover:underline">
              Manage your own listing
            </span>
          </A>
        </header>

        <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside class="hidden w-[248px] shrink-0 lg:sticky lg:top-8 lg:block">
            <h2 class="font-display text-lg font-semibold text-text">
              Filters
            </h2>
            <div class="mt-4">{filterPanel("sidebar")}</div>
          </aside>

          <section
            aria-labelledby="partners-heading"
            class="flex min-w-0 flex-1 flex-col gap-4"
          >
            <h2 id="partners-heading" class="sr-only">
              Partners
            </h2>

            <div class="flex flex-wrap items-end gap-3">
              <SearchField
                value={draft()}
                onInput={onSearchInput}
                onClear={clearSearch}
                class="min-w-[220px] flex-1"
              />
              <SortSelect
                value={view().sort}
                onChange={(sort) => update({ sort })}
                class="w-full sm:w-48"
              />
              <FiltersButton
                count={filters()}
                onClick={() => setDrawerOpen(true)}
                class="lg:hidden"
              />
            </div>

            <Show when={loaded()}>
              {(value) => (
                <p class="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
                  <span>
                    <span class="font-mono tabular-nums text-text">
                      {total()}
                    </span>{" "}
                    {countLabel(total())}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{freshnessLabel(value().loadedAt, now())}</span>
                </p>
              )}
            </Show>

            <Show when={favoriteError()}>
              {(error) => <Notice tone="error">{error()}</Notice>}
            </Show>

            <Switch>
              <Match when={isLoading(data)}>
                <CardGridSkeleton />
              </Match>

              <Match when={data.state === "errored"}>
                <WidgetError what="the marketplace" onRetry={() => refetch()} />
              </Match>

              <Match when={partners().length > 0}>
                <div
                  aria-busy={refreshing()}
                  class={cn(
                    "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
                    "animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none",
                    refreshing() && "opacity-60",
                  )}
                >
                  <For each={partners()}>
                    {(partner) => (
                      <PartnerCard
                        partner={partner}
                        favorite={favoriteIds().has(partner.id)}
                        pending={pending().has(partner.id)}
                        onToggleFavorite={onToggleFavorite}
                      />
                    )}
                  </For>
                </div>

                <Show when={pageCount(result()!) > 1}>
                  <Pagination
                    page={view().page}
                    pageCount={pageCount(result()!)}
                    onChange={(page) => {
                      update({ page });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                </Show>
              </Match>

              <Match when={filters() > 0}>
                <EmptyState
                  icon={IconMoodSearch}
                  title="No partners match these filters"
                  action={
                    <button
                      type="button"
                      onClick={clearFilters}
                      class="font-medium text-primary underline underline-offset-4"
                    >
                      Clear filters
                    </button>
                  }
                >
                  Try a broader category, a lower minimum rating, or a shorter
                  search.
                </EmptyState>
              </Match>

              <Match when={true}>
                <EmptyState
                  icon={IconBuildingStore}
                  title="No partners listed yet"
                  action={
                    <A
                      href="/marketplace/projects"
                      class="font-medium text-primary underline underline-offset-4"
                    >
                      Publish your own listing
                    </A>
                  }
                >
                  As local businesses join Flonion they'll appear here. Publish
                  your services so they can find you too.
                </EmptyState>
              </Match>
            </Switch>
          </section>
        </div>

        <FiltersDrawer
          open={drawerOpen()}
          onClose={() => setDrawerOpen(false)}
          applyLabel={applyLabel()}
        >
          {filterPanel("drawer")}
        </FiltersDrawer>
      </div>
    </>
  );
}

/** Immutable update so the resource sees a new Set and re-renders. */
function nextFavorites(
  ids: ReadonlySet<string> | undefined,
  id: string,
  favorite: boolean,
): ReadonlySet<string> {
  const next = new Set(ids ?? []);
  if (favorite) next.add(id);
  else next.delete(id);
  return next;
}
