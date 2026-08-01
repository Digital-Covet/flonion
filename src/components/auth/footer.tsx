import { For, Show, type Component } from 'solid-js';
import type { FooterProps } from '@/types/auth-ui';

export const Footer: Component<FooterProps> = (props) => (
  <footer class="mt-10 w-full">
    <nav
      class="flex items-center justify-center gap-4 text-base font-medium text-muted-foreground"
      aria-label="Legal links"
    >
      <For each={props.links}>
        {(link, index) => (
          <>
            <Show when={index() > 0}>
              <span class="opacity-30" aria-hidden="true">
                /
              </span>
            </Show>
            <a
              href={link.href}
              class="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          </>
        )}
      </For>
    </nav>
  </footer>
);
