import { A } from "@solidjs/router";
import ExternalLink from "lucide-solid/icons/external-link";
import Inbox from "lucide-solid/icons/inbox";
import PenSquare from "lucide-solid/icons/pen-square";
import Share2 from "lucide-solid/icons/share-2";
import { type Component, For } from "solid-js";
import type { QuickLink } from "~/features/seo/seo-types";
import { cn } from "~/lib/cn";

interface QuickLinksCardProps {
  links: QuickLink[];
}

const LINK_ICONS: Record<string, typeof ExternalLink> = {
  ql1: ExternalLink,
  ql2: Inbox,
  ql3: PenSquare,
  ql4: Share2,
};

const QuickLinksCard: Component<QuickLinksCardProps> = (props) => (
  <div class="rounded-card border border-border bg-card p-6 shadow-sm">
    <h3 class="mb-4 font-heading text-lg font-medium text-foreground">Quick Links</h3>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <For each={props.links}>
        {(link) => {
          const Icon = LINK_ICONS[link.id] ?? ExternalLink;
          const linkClasses = cn(
            "flex flex-col items-center gap-2 rounded-card border border-border p-4 text-center transition-all hover:border-primary/40 hover:bg-muted hover:text-primary",
            "text-muted-foreground",
          );

          const content = (
            <>
              <div class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <Icon size={18} />
              </div>
              <span class="text-sm font-medium">{link.label}</span>
              {link.external && (
                <ExternalLink size={10} class="text-muted-foreground" />
              )}
            </>
          );

          return link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              class={cn(linkClasses, "group")}
            >
              {content}
            </a>
          ) : (
            <A href={link.href} class={cn(linkClasses, "group")}>
              {content}
            </A>
          );
        }}
      </For>
    </div>
  </div>
);

export default QuickLinksCard;
