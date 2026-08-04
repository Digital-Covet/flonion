import { Dynamic } from 'solid-js/web'
import { createMemo, type Component } from 'solid-js'
import type { ActionItemData, ActionStatus, ActionType } from '../../types'
import { cn } from '../../lib/cn'

interface ActionItemProps { item: ActionItemData }

const STATUS_CONFIG: Record<ActionStatus, { containerClass: string; badgeClass: string; badgeLabel: string; titleClass: string }> = {
  pending: {
    containerClass: 'bg-white border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-600',
    badgeLabel: 'Pending',
    titleClass: 'text-foreground',
  },
  completed: {
    containerClass: 'bg-slate-50 border-slate-100',
    badgeClass: 'bg-slate-200 text-slate-500',
    badgeLabel: 'Completed',
    titleClass: 'text-muted-foreground line-through',
  },
  'high-priority': {
    containerClass: 'bg-rose-50/50 border-rose-100',
    badgeClass: 'bg-rose-600 text-white',
    badgeLabel: 'High Priority',
    titleClass: 'text-foreground',
  },
}

const ActionItemCard: Component<ActionItemProps> = (props) => {
  const config = createMemo(() => STATUS_CONFIG[props.item.status])

  return (
    <div class={cn(
      'rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all',
      config().containerClass
    )}>
      <div class="flex items-start gap-4">
        {/* Icon wrapper - removed excessive logic, simplified to a clean neutral circle */}
        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
          <Dynamic component={props.item.icon} size={20} />
        </div>

        <div>
          <div class="flex items-center gap-2 mb-1">
            <h4 class={cn('font-semibold text-base', config().titleClass)}>
              {props.item.title}
            </h4>
            <span class={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', config().badgeClass)}>
              {config().badgeLabel}
            </span>
          </div>
          <p class="text-sm text-slate-500">{props.item.description}</p>
        </div>
      </div>
      <ActionButton type={props.item.actionType} label={props.item.actionLabel} status={props.item.status} />
    </div>
  )
}

const ActionButton: Component<{ type: ActionType; label: string; status: ActionStatus }> = (props) => {
  const buttonClass = createMemo(() => {
    if (props.status === 'completed') {
      return 'bg-slate-100 border border-slate-200 text-slate-400 cursor-default'
    }
    if (props.status === 'high-priority') {
      return 'bg-rose-600 text-white hover:bg-rose-700'
    }
    return props.type === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
  })

  return (
    <button class={cn(
      'shrink-0 h-10 px-5 rounded-lg font-medium text-sm transition-all whitespace-nowrap',
      buttonClass()
    )}>
      {props.label}
    </button>
  )
}

export default ActionItemCard
