import { type Component, For, createSignal, createMemo, Show } from 'solid-js'
import Sparkles from 'lucide-solid/icons/sparkles'
import Square from 'lucide-solid/icons/square'
import SquareCheck from 'lucide-solid/icons/square-check'
import type { KeywordSuggestion, SearchVolume } from '~/features/seo/seo-types'
import { VOLUME_COLORS } from '~/features/seo/seo-data'
import { cn } from '~/lib/cn'

interface KeywordRecommendationsProps {
  keywords: KeywordSuggestion[]
}

const VolumeBadge: Component<{ volume: SearchVolume }> = (props) => {
  const colors = VOLUME_COLORS[props.volume]
  return (
    <span class={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', colors.bg, colors.text)}>
      {props.volume}
    </span>
  )
}

const KeywordRecommendations: Component<KeywordRecommendationsProps> = (props) => {
  const [usedIds, setUsedIds] = createSignal(
    new Set(props.keywords.filter((k) => k.currentlyUsed).map((k) => k.id))
  )

  const sortedKeywords = createMemo(() =>
    [...props.keywords].sort((a, b) => {
      const aUsed = usedIds().has(a.id)
      const bUsed = usedIds().has(b.id)
      if (aUsed !== bUsed) return aUsed ? 1 : -1
      return b.relevance - a.relevance
    })
  )

  const toggleKeyword = (id: string) => {
    setUsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const usedCount = createMemo(() => usedIds().size)

  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">Keyword Recommendations</h3>
            <p class="text-xs text-slate-500">AI-analyzed search terms for your area</p>
          </div>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {usedCount()}/{props.keywords.length} active
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        <For each={sortedKeywords()}>
          {(kw) => {
            const isActive = () => usedIds().has(kw.id)
            return (
              <button
                type="button"
                onClick={() => toggleKeyword(kw.id)}
                class={cn(
                  'group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                  isActive()
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <span
                  class={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded transition-all',
                    isActive()
                      ? 'text-blue-500'
                      : 'text-slate-300 group-hover:text-slate-400'
                  )}
                >
                  <Show when={isActive()} fallback={<Square size={14} />}>
                    <SquareCheck size={14} />
                  </Show>
                </span>
                <span>{kw.keyword}</span>
                <VolumeBadge volume={kw.searchVolume} />
                <span class="ml-1 text-[10px] text-slate-400">{kw.relevance}%</span>
              </button>
            )
          }}
        </For>
      </div>

      <div class="mt-5 border-t border-slate-100 pt-4">
        <p class="text-xs text-slate-500">
          Click to toggle keywords. High-volume keywords in your area are shown first.
          Relevance scores indicate how well each term matches your business profile.
        </p>
      </div>
    </div>
  )
}

export default KeywordRecommendations
