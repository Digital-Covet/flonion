import type { Component } from 'solid-js';
import type { DividerProps } from '@/types/auth-ui';

export const Divider: Component<DividerProps> = (props) => (
  <div
    class={`flex w-full items-center gap-4 my-6 ${props.class ?? ''}`}
    role="separator"
    aria-orientation="horizontal"
  >
    <span class="h-px flex-1 bg-border" />
    <span class="font-sans text-xs uppercase tracking-widest text-muted-foreground">
      {props.label ?? 'OR'}
    </span>
    <span class="h-px flex-1 bg-border" />
  </div>
);
