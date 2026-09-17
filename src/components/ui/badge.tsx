import Frown from "lucide-solid/icons/frown";
import Meh from "lucide-solid/icons/meh";
import Smile from "lucide-solid/icons/smile";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { IconComponent } from "~/types";

/**
 * Phase 1 primitive — spec §2: semantic color NEVER relies on hue alone.
 * Every badge pairs a Lucide icon + text label ("Positive", "Needs reply",
 * "Expired"). Star ratings additionally pair with a numeric `4.6 (128)` string.
 */
export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent"
  | "neutral";

const tones: Record<BadgeTone, string> = {
  primary: "bg-positive-muted text-primary",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  info: "bg-info-muted text-info-text",
  accent: "bg-purple-muted text-purple",
  neutral: "bg-muted text-muted-foreground",
};

export function Badge(props: {
  tone?: BadgeTone;
  icon?: IconComponent;
  children: JSX.Element;
  class?: string;
}) {
  const tone = () => props.tone ?? "neutral";
  const Icon = () => props.icon as Component<{ class?: string }> | undefined;
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone()]} ${props.class ?? ""}`}
    >
      {(() => {
        const C = Icon();
        return C ? <C class="size-3.5" aria-hidden="true" /> : null;
      })()}
      {props.children}
    </span>
  );
}

/** Sentiment chip (DS §2) — icon + word + colour, never colour alone. */
export function SentimentBadge(props: {
  sentiment: "positive" | "neutral" | "negative";
  label?: string;
  class?: string;
}) {
  const map = {
    positive: { tone: "success" as const, text: "Positive", icon: Smile },
    neutral: { tone: "warning" as const, text: "Mixed", icon: Meh },
    negative: { tone: "destructive" as const, text: "Negative", icon: Frown },
  } as const;
  const entry = () => map[props.sentiment];
  return (
    <span
      role="status"
      class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tones[entry().tone]} ${props.class ?? ""}`}
    >
      <Dynamic component={entry().icon} size={14} aria-hidden="true" />
      {props.label ?? entry().text}
    </span>
  );
}
