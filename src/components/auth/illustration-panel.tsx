import type { Component } from 'solid-js';
import type { IllustrationPanelProps } from '@/types/auth-ui';

export const IllustrationPanel: Component<IllustrationPanelProps> = (props) => (
  <section
    class="relative hidden md:flex md:w-2/5 items-center justify-center overflow-hidden bg-muted"
    aria-hidden="true"
  >
    <div class="absolute inset-0 z-0">
      <img
        src={props.imageSrc}
        alt={props.imageAlt ?? ''}
        class="h-full w-full object-cover opacity-80"
        loading="lazy"
      />
    </div>
    <div class="absolute inset-0 z-10 bg-gradient-to-r from-muted/20 to-muted/60" />
  </section>
);
