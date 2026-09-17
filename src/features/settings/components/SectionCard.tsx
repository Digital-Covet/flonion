import type { LucideIcon } from "lucide-solid";
import Sparkles from "lucide-solid/icons/sparkles";
import { type JSX, Show } from "solid-js";

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: JSX.Element;
  class?: string;
  showAiBadge?: boolean;
  /** Anchor target for the settings section nav. */
  id?: string;
}

export function SectionCard(props: SectionCardProps) {
  return (
    <section
      id={props.id}
      class={`relative overflow-hidden rounded-card border border-border bg-card p-6 scroll-mt-24 ${props.class ?? ""}`}
    >
      <Show when={props.showAiBadge}>
        <div class="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
      </Show>
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <props.icon size={20} class="text-primary" aria-hidden="true" />
          {/* h2: the page H1 lives in SettingsShell; sections are H2 (DS §6). */}
          <h2 class="font-heading text-lg font-semibold">{props.title}</h2>
        </div>
        <Show when={props.showAiBadge}>
          <div class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
            <Sparkles size={16} class="text-primary" />
            <span class="text-xs leading-4 font-medium text-primary">
              AI Ready
            </span>
          </div>
        </Show>
      </div>
      {props.children}
    </section>
  );
}
