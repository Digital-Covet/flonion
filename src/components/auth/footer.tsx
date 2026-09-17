import { type Component, For, Show } from "solid-js";
import type { FooterProps } from "@/types/auth-ui";

/** Flonion DS §6 auth footer: small muted legal links + trust line. */
export const Footer: Component<FooterProps> = (props) => (
  <footer class="mt-8 w-full">
    <nav
      class="flex min-h-11 items-center justify-center gap-3 text-sm text-muted-foreground"
      aria-label="Legal links"
    >
      <For each={props.links}>
        {(link, index) => (
          <>
            <Show when={index() > 0}>
              <span class="text-border" aria-hidden="true">
                /
              </span>
            </Show>
            <a
              href={link.href}
              class="min-h-11 content-center transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </a>
          </>
        )}
      </For>
    </nav>
  </footer>
);
