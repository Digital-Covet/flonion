import { Tooltip } from '@ark-ui/solid'
import { Dynamic } from 'solid-js/web'
import type { Component } from 'solid-js'
import type { IconComponent } from '../../types'

interface IconButtonProps {
  icon: IconComponent
  label: string
}

const IconButton: Component<IconButtonProps> = (props) => {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        class="text-muted-foreground hover:bg-muted dark:hover:bg-card transition-colors p-2 rounded-full"
        aria-label={props.label}
      >
        <Dynamic component={props.icon} size={24} />
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content class="bg-foreground text-background px-2 py-1 rounded text-body-sm font-medium z-50 shadow-lg">
          {props.label}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  )
}

export default IconButton
