import { For, type Component } from 'solid-js'
import { ListChecks } from 'lucide-solid'
import type { ActionItemData } from '../../types'
import ActionItemCard from './ActionItem'

interface ActionListProps { items: ActionItemData[] }

const ActionList: Component<ActionListProps> = (props) => {
  return (
    <div class="mt-8">
      <h3 class="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
        <div class="p-2 bg-emerald-100 rounded-lg text-emerald-600">
          <ListChecks size={20} />
        </div>
        AI-Recommended Actions
      </h3>
      <div class="space-y-4">
        <For each={props.items}>{(item) => <ActionItemCard item={item} />}</For>
      </div>
    </div>
  )
}
export default ActionList
