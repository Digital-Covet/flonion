import { Avatar } from '@ark-ui/solid'
import type { Component } from 'solid-js'

interface UserAvatarProps {
  src: string
  alt: string
  fallback: string
}

const UserAvatar: Component<UserAvatarProps> = (props) => {
  return (
    <Avatar.Root class="w-8 h-8 rounded-full border border-border overflow-hidden shrink-0">
      <Avatar.Fallback class="flex items-center justify-center w-full h-full text-xs font-medium bg-muted text-muted-foreground">
        {props.fallback}
      </Avatar.Fallback>
      <Avatar.Image
        src={props.src}
        alt={props.alt}
        class="w-full h-full object-cover"
      />
    </Avatar.Root>
  )
}

export default UserAvatar
