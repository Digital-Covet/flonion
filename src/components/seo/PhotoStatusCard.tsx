import { type Component, For } from 'solid-js'
import Camera from 'lucide-solid/icons/camera'
import Sparkles from 'lucide-solid/icons/sparkles'
import type { PhotoStatus } from '~/features/seo/seo-types'
import { cn } from '~/lib/cn'

interface PhotoStatusCardProps {
  status: PhotoStatus
}

const CATEGORY_COLORS: Record<string, string> = {
  Exterior: 'bg-emerald-500',
  Interior: 'bg-violet-500',
  Products: 'bg-emerald-500',
  Team: 'bg-amber-500',
}

const PhotoStatusCard: Component<PhotoStatusCardProps> = (props) => {
  const maxCount = () => Math.max(...props.status.byCategory.map((c) => c.count), 1)

  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
      <div class="mb-5 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Camera size={20} />
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-900">Photo Status</h3>
          <p class="text-xs text-slate-500">{props.status.total} photos total</p>
        </div>
      </div>

      <div class="space-y-3">
        <For each={props.status.byCategory}>
          {(item) => (
            <div>
              <div class="mb-1 flex items-center justify-between text-xs">
                <span class="font-medium text-slate-700">{item.category}</span>
                <span class="text-slate-500">{item.count}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class={cn('h-full rounded-full transition-all', CATEGORY_COLORS[item.category] ?? 'bg-slate-400')}
                  style={{ width: `${(item.count / maxCount()) * 100}%` }}
                />
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="mt-5 border-t border-slate-100 pt-4">
        <p class="text-xs text-slate-500">
          Last added: <span class="font-medium text-slate-700">{props.status.lastAdded}</span>
        </p>
      </div>

      <div class="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
        <Sparkles size={14} class="mt-0.5 shrink-0 text-emerald-500" />
        <p class="text-xs leading-relaxed text-emerald-700">{props.status.recommendation}</p>
      </div>
    </div>
  )
}

export default PhotoStatusCard
