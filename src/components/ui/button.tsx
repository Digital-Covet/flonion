import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  // Primary action: #5B21B6 (white label 8.98:1 — AAA, DS §2), hover #4C1D95.
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover disabled:bg-primary",
  secondary: "bg-muted text-foreground hover:bg-border/60 disabled:bg-muted",
  outline:
    "border border-border bg-card text-foreground hover:bg-muted disabled:bg-card",
  ghost: "text-primary hover:bg-positive-muted disabled:text-primary",
  destructive:
    "bg-destructive text-white shadow-sm hover:bg-destructive/90 disabled:bg-destructive",
};

const sizes: Record<ButtonSize, string> = {
  // App-scope icon-adjacent small; base md meets 36px; lg is 48px for
  // public/booking/auth surfaces (§2 touch targets: 44x44 min public).
  sm: "h-9 px-3 text-sm min-h-9",
  md: "h-11 px-4 text-sm min-h-11",
  lg: "h-12 px-5 text-base min-h-12",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `inline-flex items-center justify-center gap-2 rounded-control font-medium transition-opacity duration-180 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${extra}`;
}

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

/** Phase 1 primitive — spec §5/§6. E1 180ms opacity; focus ring #0060FF. */
export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "loading",
    "loadingLabel",
    "class",
    "children",
    "disabled",
  ]);
  return (
    <button
      class={buttonStyles(local.variant, local.size, local.class ?? "")}
      disabled={local.disabled || local.loading}
      aria-busy={local.loading || undefined}
      {...rest}
    >
      <Show when={local.loading} fallback={local.children}>
        <span
          class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
        {local.loadingLabel ?? "Loading…"}
      </Show>
    </button>
  );
}

export interface ButtonLinkProps
  extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink(props: ButtonLinkProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "class"]);
  return (
    <a
      class={buttonStyles(local.variant, local.size, local.class ?? "")}
      {...rest}
    />
  );
}
