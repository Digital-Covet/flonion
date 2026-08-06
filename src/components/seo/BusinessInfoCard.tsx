import { type Component, For } from 'solid-js'
import Building2 from 'lucide-solid/icons/building-2'
import Phone from 'lucide-solid/icons/phone'
import Globe from 'lucide-solid/icons/globe'
import MapPin from 'lucide-solid/icons/map-pin'
import Star from 'lucide-solid/icons/star'
import Edit from 'lucide-solid/icons/edit'
import ExternalLink from 'lucide-solid/icons/external-link'
import type { BusinessInfo } from '~/features/seo/seo-types'

interface BusinessInfoCardProps {
  info: BusinessInfo
}

const StarRating: Component<{ rating: number; reviewCount: number }> = (props) => {
  return (
    <div class="flex items-center gap-1.5">
      <div class="flex items-center gap-0.5">
        <For each={[1, 2, 3, 4, 5]}>
          {(i) => (
            <Star
              size={14}
              class={i <= Math.round(props.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
            />
          )}
        </For>
      </div>
      <span class="text-sm font-semibold text-slate-900">{props.rating}</span>
      <span class="text-xs text-slate-500">({props.reviewCount} reviews)</span>
    </div>
  )
}

const InfoRow: Component<{ icon: typeof Phone; label: string; value: string }> = (props) => (
  <div class="flex items-start gap-3">
    <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      <props.icon size={16} />
    </div>
    <div class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-400">{props.label}</p>
      <p class="text-sm text-slate-700 truncate">{props.value}</p>
    </div>
  </div>
)

const BusinessInfoCard: Component<BusinessInfoCardProps> = (props) => {
  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-5 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Building2 size={20} />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">{props.info.name}</h3>
            <p class="text-xs text-slate-500">Google Business Profile</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={props.info.reviewLink}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ExternalLink size={12} />
            View on Google
          </a>
          <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
            <Edit size={12} />
            Edit Profile
          </button>
        </div>
      </div>

      <p class="mb-5 text-sm leading-relaxed text-slate-600">{props.info.description}</p>

      <div class="mb-5 flex flex-wrap gap-2">
        <For each={props.info.categories}>
          {(cat) => (
            <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {cat}
            </span>
          )}
        </For>
      </div>

      <StarRating rating={props.info.rating} reviewCount={props.info.reviewCount} />

      <div class="mt-5 space-y-4 border-t border-slate-100 pt-5">
        <InfoRow icon={Phone} label="Phone" value={props.info.phone} />
        <InfoRow icon={Globe} label="Website" value={props.info.website} />
        <InfoRow icon={MapPin} label="Address" value={props.info.address} />
      </div>

      <div class="mt-5 border-t border-slate-100 pt-5">
        <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Operating Hours</p>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          <For each={Object.entries(props.info.hours)}>
            {([day, hours]) => (
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-slate-700">{day}</span>
                <span class="text-slate-500">
                  {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

export default BusinessInfoCard
