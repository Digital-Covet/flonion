import type { JSX } from "solid-js";
import { cn } from "~/lib/cn";

interface GlassCardProps {
  class?: string;
  children: JSX.Element;
  hover?: boolean;
}

export const GlassCard = (props: GlassCardProps) => (
  <div
    class={cn(
      "glass-card rounded-xl p-6",
      props.hover && "hover:bg-positive-muted transition-colors",
      props.class
    )}
  >
    {props.children}
  </div>
);
