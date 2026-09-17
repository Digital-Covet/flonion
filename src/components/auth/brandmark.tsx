import type { Component } from "solid-js";
import LogoMark from "@/assets/logomark";

/**
 * Flonion DS §2: Jost wordmark + mark, compact for the 440px auth card.
 * Decorative mark — the adjacent wordmark names the product.
 */
export const BrandMark: Component<{ class?: string }> = (props) => (
  <a
    href="/"
    class={`inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${props.class ?? ""}`}
    aria-label="Flonion home"
  >
    <LogoMark class="h-9 w-9" aria-hidden="true" />
    <span class="font-heading text-xl font-semibold tracking-tight text-foreground">
      Flonion
    </span>
  </a>
);
