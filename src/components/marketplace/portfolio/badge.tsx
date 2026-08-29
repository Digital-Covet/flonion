import type { JSX } from "solid-js";
import { cn } from "~/lib/cn";

interface BadgeProps {
  children: JSX.Element;
  class?: string;
}

export const Badge = (props: BadgeProps) => (
  <span
    class={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full bg-positive-muted text-primary text-xs font-medium uppercase tracking-wide",
      props.class
    )}
  >
    {props.children}
  </span>
);
