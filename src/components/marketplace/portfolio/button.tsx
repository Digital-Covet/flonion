import type { JSX } from "solid-js";
import { cn } from "~/lib/cn";

type ButtonVariant = "primary" | "outline" | "ghost" | "dark";

interface ButtonProps {
  variant?: ButtonVariant;
  class?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: JSX.Element;
}

const base =
  "inline-flex items-center justify-center font-medium transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover px-6 py-2.5 text-base shadow-sm",
  outline:
    "bg-card text-foreground border border-border hover:bg-muted px-6 py-2.5 text-base",
  ghost:
    "text-primary hover:bg-positive-muted px-3 py-2 text-sm font-medium",
  dark: "bg-foreground text-primary-foreground hover:bg-foreground/90 w-full py-2.5 text-base shadow-sm",
};

export const Button = (props: ButtonProps) => (
  <button
    type={props.type ?? "button"}
    class={cn(base, variants[props.variant ?? "primary"], props.class)}
    onClick={props.onClick}
    disabled={props.disabled}
  >
    {props.children}
  </button>
);
