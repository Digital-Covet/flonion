import type { Component } from 'solid-js'
import Sparkles from 'lucide-solid/icons/sparkles'
import type { ProgressData } from '../../types'
import { ProgressRoot, ProgressCircle, ProgressCircleTrack, ProgressCircleRange } from '../ui/progress'

const ProgressTracker: Component<ProgressData> = (props) => {
  return (
    <div class="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
      <div class="relative w-16 h-16 shrink-0">
        <ProgressRoot value={props.value} min={0} max={100}>
          <ProgressCircle>
            <ProgressCircleTrack class="stroke-slate-100" />
            <ProgressCircleRange class="stroke-emerald-600" stroke-linecap="round" />
          </ProgressCircle>
        </ProgressRoot>
        <div class="absolute inset-0 flex items-center justify-center font-bold text-slate-900">
          {props.value}%
        </div>
      </div>

      <div class="flex-1 text-center md:text-left">
        <h3 class="text-xl font-bold text-slate-900">{props.title}</h3>
        <p class="text-slate-600 mt-1 mb-4">{props.description}</p>

        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
          <Sparkles size={14} />
          AI Analysis Active
        </div>
      </div>
    </div>
  )
}
export default ProgressTracker
