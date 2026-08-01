import LayoutDashboard from 'lucide-solid/icons/layout-dashboard'
import Inbox from 'lucide-solid/icons/inbox'
import SearchCheck from 'lucide-solid/icons/search-check'
import Settings from 'lucide-solid/icons/settings'
import Bell from 'lucide-solid/icons/bell'
import HelpCircle from 'lucide-solid/icons/help-circle'
import Sparkles from 'lucide-solid/icons/sparkles'
import ListChecks from 'lucide-solid/icons/list-checks'
import ImagePlus from 'lucide-solid/icons/image-plus'
import CheckCircle2 from 'lucide-solid/icons/check-circle-2'
import MapPin from 'lucide-solid/icons/map-pin'
import BarChart3 from 'lucide-solid/icons/bar-chart-3'
import ExternalLink from 'lucide-solid/icons/external-link'
import type {
  NavItem,
  ActionItemData,
  BrandData,
  PageHeaderData,
  NavId,
} from '../types'

export const GOOGLE_PLACE_ID = "ChIJGblnVa655zsRtRfkePjHE8E"

export const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`

export const ACTIVE_NAV_ID: NavId = 'dashboard'

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'reviews-inbox', label: 'Review Inbox', shortLabel: 'Inbox', icon: Inbox, href: '/reviews/inbox' },
  { id: 'reviews-new', label: 'Leave a Review', shortLabel: 'Review', icon: ExternalLink, href: '/reviews/new' },
  { id: 'marketing-seo', label: 'SEO Optimizer', shortLabel: 'SEO', icon: SearchCheck, href: '/marketing/seo' },
  { id: 'marketing-campaigns', label: 'Campaigns', shortLabel: 'Campaigns', icon: Sparkles, href: '/marketing/campaigns' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings, href: '/settings' },
]

export const BRAND: BrandData = {
  title: 'Flonion',
  subtitle: 'Grow Your Business with Better Reviews',
  icon: BarChart3,
}

export const PAGE_HEADER: PageHeaderData = {
  title: 'GMB SEO Optimizer',
  subtitle: 'AI-driven insights to improve your local search visibility.',
}

export const PROGRESS: { value: number; title: string; description: string } = {
  value: 70,
  title: 'Profile Optimization Strength',
  description:
    'Your profile is missing key information that could boost local rankings. Completing the recommended actions below will increase your visibility.',
}

export const ACTION_ITEMS: ActionItemData[] = [
  {
    id: 'add-photos',
    title: 'Add 3 new exterior photos',
    description: 'Fresh images increase engagement by 42% on local listings.',
    status: 'pending',
    icon: ImagePlus,
    actionLabel: 'Upload Photos',
    actionType: 'primary',
  },
  {
    id: 'holiday-hours',
    title: 'Update holiday operating hours',
    description: 'Completed on Nov 12, 2023.',
    status: 'completed',
    icon: CheckCircle2,
    actionLabel: 'Edit',
    actionType: 'secondary',
  },
  {
    id: 'fix-address',
    title: 'Fix inconsistent address data',
    description:
      'AI detected discrepancies between your website and local directories.',
    status: 'high-priority',
    icon: MapPin,
    actionLabel: 'Fix Now',
    actionType: 'primary',
  },
]

export const TOPBAR_ICONS = [
  { icon: Bell, label: 'Notifications' },
  { icon: HelpCircle, label: 'Help' },
] as const

export const USER_AVATAR = {
  src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvffMNkvrzOck_1yKY12efuoh8F_gTf5f8eyOqUG-UsUQy6daDvP6Ebavztpy-YtxmZ1Uj3Ta0syxUDfvlgtPGlkH7VupHVV_8bPHtaUeqGc8GXjNZeXJlasKU7EN7rpJt1iGB23X_12MBIdg6Y9eUp6KPYD73ao3L7a_hj9RaNc2QtrB6GlIy0IMILxRRqzWMcVz_Z2kNM3emo4WglpfmCOhHfsB8uakLY5_7TpCEqCIkQG7cvDxrCw',
  alt: 'User Profile Avatar',
  fallback: 'CE',
} as const
