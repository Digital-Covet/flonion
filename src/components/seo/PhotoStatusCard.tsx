import { type Component, For } from 'solid-js'
import Camera from 'lucide-solid/icons/camera'
import Sparkles from 'lucide-solid/icons/sparkles'
import type { PhotoStatus } from '~/features/seo/seo-types'
import { cn } from '~/lib/cn'

interface PhotoStatusCardProps {
  status: PhotoStatus
}

const CATEGORY_COLORS: Record<string, string> = {
  Exterior: 'bg-blue-500',
  Interior: 'bg-violet-500',
  Products: 'bg-amber-500',
  Team: 'bg-sky-500',
}

function photoBarColor(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0
  if (ratio >= 0.7) return 'bg-blue-500'
  if (ratio >= 0.4) return 'bg-amber-400'
  return 'bg-rose-400'
}

const PhotoStatusCard: Component<PhotoStatusCardProps> = (props) => {
  const maxCount = () => Math.max(...props.status.byCategory.map((c) => c.count), 1)

  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
      <div class="mb-5 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
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
                <span class="flex items-center gap-1.5 font-medium text-slate-700">
                  <span class={`inline-block size-2 rounded-full ${CATEGORY_COLORS[item.category] ?? 'bg-slate-400'}`} />
                  {item.category}
                </span>
                <span class="text-slate-500">{item.count}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class={cn('h-full rounded-full transition-all', photoBarColor(item.count, maxCount()))}
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

      <div class="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3">
        <Sparkles size={14} class="mt-0.5 shrink-0 text-blue-500" />
        <p class="text-xs leading-relaxed text-blue-700">{props.status.recommendation}</p>
      </div>
    </div>
  )
}

export default PhotoStatusCard
