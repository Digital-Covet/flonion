import Sparkles from "lucide-solid/icons/sparkles";
import Square from "lucide-solid/icons/square";
import SquareCheckBig from "lucide-solid/icons/square-check-big";
import TrendingDown from "lucide-solid/icons/trending-down";
import TrendingUp from "lucide-solid/icons/trending-up";
import { type Component, createMemo, createSignal, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { DataTable } from "~/components/ui/table";
import type { KeywordSuggestion, SearchVolume } from "~/features/seo/seo-types";

interface KeywordRecommendationsProps {
  keywords: KeywordSuggestion[];
}

/* DS §2: volume is icon + words + colour, never colour alone. */
const VOLUME_META: Record<
  SearchVolume,
  { pill: string; label: string; Icon: typeof TrendingUp }
> = {
  high: {
    pill: "bg-success-muted text-success",
    label: "High volume",
    Icon: TrendingUp,
  },
  medium: {
    pill: "bg-warning-muted text-warning",
    label: "Medium volume",
    Icon: TrendingUp,
  },
  low: {
    pill: "bg-muted text-muted-foreground",
    label: "Low volume",
    Icon: TrendingDown,
  },
};

const VolumeBadge: Component<{ volume: SearchVolume }> = (props) => {
  const meta = () => VOLUME_META[props.volume];
  const Icon = () => meta().Icon;
  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${meta().pill}`}
    >
      <Dynamic component={Icon()} size={12} aria-hidden="true" />
      {props.volume}
      <span class="sr-only"> search volume</span>
    </span>
  );
};

const KeywordRecommendations: Component<KeywordRecommendationsProps> = (
  props,
) => {
  const [usedIds, setUsedIds] = createSignal(
    new Set(props.keywords.filter((k) => k.currentlyUsed).map((k) => k.id)),
  );

  const sortedKeywords = createMemo(() =>
    [...props.keywords].sort((a, b) => {
      const aUsed = usedIds().has(a.id);
      const bUsed = usedIds().has(b.id);
      if (aUsed !== bUsed) return aUsed ? 1 : -1;
      return b.relevance - a.relevance;
    }),
  );

  const toggleKeyword = (id: string) => {
    setUsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const usedCount = createMemo(() => usedIds().size);

  return (
    <div class="rounded-card border border-border bg-card p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="grid size-10 place-items-center rounded-control bg-positive-muted text-primary">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 class="font-heading text-lg font-medium text-foreground">
              Keyword recommendations
            </h3>
            <p class="text-xs text-muted-foreground">
              AI-analyzed search terms for your area
            </p>
          </div>
        </div>
        <span class="tnum rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {usedCount()}/{props.keywords.length} active
        </span>
      </div>

      <DataTable
        caption="Keyword recommendations with search volume and relevance"
        columns={[
          {
            header: "Keyword",
            render: (kw) => (
              <span class="font-medium text-foreground">{kw.keyword}</span>
            ),
          },
          {
            header: "Volume",
            render: (kw) => <VolumeBadge volume={kw.searchVolume} />,
          },
          {
            header: "Relevance",
            numeric: true,
            render: (kw) => (
              <span class="tnum text-right text-foreground">
                {kw.relevance}%
              </span>
            ),
          },
          {
            header: "Status",
            render: (kw) => {
              const isActive = () => usedIds().has(kw.id);
              return (
                <button
                  type="button"
                  onClick={() => toggleKeyword(kw.id)}
                  aria-pressed={isActive()}
                  aria-label={`${isActive() ? "Deactivate" : "Activate"} keyword ${kw.keyword}`}
                  class={`inline-flex h-11 items-center gap-1.5 rounded-control border px-3 text-xs font-medium transition-opacity duration-180 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isActive()
                      ? "border-primary bg-positive-muted text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Show
                    when={isActive()}
                    fallback={<Square size={14} aria-hidden="true" />}
                  >
                    <SquareCheckBig size={14} aria-hidden="true" />
                  </Show>
                  {isActive() ? "Active" : "Use"}
                </button>
              );
            },
          },
        ]}
        rows={sortedKeywords()}
        rowKey={(kw) => kw.id}
      />

      <div class="mt-4 border-t border-border pt-3">
        <p class="text-xs text-muted-foreground">
          Toggle keywords to track them. High-volume terms for your area are
          shown first. Relevance is how well each term matches your profile.
        </p>
      </div>
    </div>
  );
};

export default KeywordRecommendations;
