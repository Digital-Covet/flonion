import { Show, type JSX } from "solid-js";
import { Sparkles } from "lucide-solid";
import type { LucideIcon } from "lucide-solid";

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: JSX.Element;
  class?: string;
  showAiBadge?: boolean;
}

export function SectionCard(props: SectionCardProps) {
  return (
    <section
      class={`relative overflow-hidden rounded-xl border border-border bg-card p-6 ${props.class ?? ""}`}
    >
      <Show when={props.showAiBadge}>
        <div class="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
      </Show>
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <props.icon size={20} class="text-primary" />
          <h3 class="text-lg leading-7 font-semibold">{props.title}</h3>
        </div>
        <Show when={props.showAiBadge}>
          <div class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1">
            <Sparkles size={16} class="text-emerald-700" />
            <span class="text-xs leading-4 font-medium text-emerald-700">
              AI Ready
            </span>
          </div>
        </Show>
      </div>
      {props.children}
    </section>
  );
}
