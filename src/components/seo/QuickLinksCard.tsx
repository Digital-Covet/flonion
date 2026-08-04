import { type Component, For } from 'solid-js'
import ExternalLink from 'lucide-solid/icons/external-link'
import Inbox from 'lucide-solid/icons/inbox'
import PenSquare from 'lucide-solid/icons/pen-square'
import Share2 from 'lucide-solid/icons/share-2'
import { A } from '@solidjs/router'
import type { QuickLink } from '~/features/seo/seo-types'
import { cn } from '~/lib/cn'

interface QuickLinksCardProps {
  links: QuickLink[]
}

const LINK_ICONS: Record<string, typeof ExternalLink> = {
  ql1: ExternalLink,
  ql2: Inbox,
  ql3: PenSquare,
  ql4: Share2,
}

const QuickLinksCard: Component<QuickLinksCardProps> = (props) => (
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h3 class="mb-4 text-lg font-bold text-slate-900">Quick Links</h3>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <For each={props.links}>
        {(link) => {
          const Icon = LINK_ICONS[link.id] ?? ExternalLink
          const linkClasses = cn(
            'flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
            'text-slate-600'
          )

          const content = (
            <>
              <div class="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                <Icon size={18} />
              </div>
              <span class="text-sm font-medium">{link.label}</span>
              {link.external && <ExternalLink size={10} class="text-slate-400" />}
            </>
          )

          return link.external ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer" class={cn(linkClasses, 'group')}>
              {content}
            </a>
          ) : (
            <A href={link.href} class={cn(linkClasses, 'group')}>
              {content}
            </A>
          )
        }}
      </For>
    </div>
  </div>
)

export default QuickLinksCard
