import { type Component, For } from 'solid-js'
import { Users, Star } from 'lucide-solid'
import type { Competitor } from '~/features/seo/seo-types'

interface CompetitorCardProps {
  competitors: Competitor[]
}

const CompetitorItem: Component<{ competitor: Competitor }> = (props) => (
  <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
    <div class="mb-3 flex items-start justify-between">
      <div>
        <h4 class="font-bold text-slate-900">{props.competitor.name}</h4>
        <p class="text-xs text-slate-500">{props.competitor.distance} away</p>
      </div>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
        {props.competitor.profileCompleteness}%
      </span>
    </div>

    <div class="mb-3 flex items-center gap-1.5">
      <div class="flex items-center gap-0.5">
        <For each={[1, 2, 3, 4, 5]}>
          {(i) => (
            <Star
              size={12}
              class={i <= Math.round(props.competitor.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
            />
          )}
        </For>
      </div>
      <span class="text-sm font-semibold text-slate-900">{props.competitor.rating}</span>
      <span class="text-xs text-slate-500">({props.competitor.reviewCount})</span>
    </div>

    <div class="mb-4">
      <div class="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Profile completeness</span>
        <span class="font-medium text-slate-700">{props.competitor.profileCompleteness}%</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${props.competitor.profileCompleteness}%` }}
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <For each={props.competitor.topCategories}>
        {(cat) => (
          <span class="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {cat}
          </span>
        )}
      </For>
    </div>
  </div>
)

const CompetitorCard: Component<CompetitorCardProps> = (props) => (
  <div>
    <div class="mb-4 flex items-center gap-3">
      <div class="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <Users size={20} />
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-900">Local Competitors</h3>
        <p class="text-xs text-slate-500">Nearby businesses in your category</p>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <For each={props.competitors}>
        {(competitor) => <CompetitorItem competitor={competitor} />}
      </For>
    </div>
  </div>
)

export default CompetitorCard
