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
        width={1200}
        height={1662}
        decoding="async"
        loading="lazy"
        class="block h-full w-full object-cover"
      />
    </div>
  </section>
);
