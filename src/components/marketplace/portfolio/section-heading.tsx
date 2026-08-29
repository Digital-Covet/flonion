import type { JSX } from "solid-js";
import { cn } from "~/lib/cn";

interface SectionHeadingProps {
  children: JSX.Element;
  class?: string;
}

export const SectionHeading = (props: SectionHeadingProps) => (
  <h3
    class={cn(
      "font-heading text-xl font-semibold text-foreground",
      props.class
    )}
  >
    {props.children}
  </h3>
);
