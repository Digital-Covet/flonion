import {
  ImagePlus,
  CheckCircle2,
  MapPin,
  FileText,
  Star,
  Globe,
  Clock,
  Camera,
  Tag,
  PenLine,
} from 'lucide-solid'
import type {
  BusinessInfo,
  KeywordSuggestion,
  Competitor,
  PhotoStatus,
  SeoScore,
  QuickLink,
} from './seo-types'
import type { ActionItemData } from '~/types'

export const SEO_PAGE_HEADER = {
  title: 'GMB SEO Optimizer',
  subtitle: 'AI-driven insights to improve your local search visibility.',
}

export const businessInfo: BusinessInfo = {
  name: 'The Golden Noodle',
  description:
    'Authentic Thai cuisine in the heart of downtown. Family-owned since 2018, serving traditional recipes with fresh, locally sourced ingredients.',
  categories: ['Thai Restaurant', 'Asian Restaurant', 'Noodles'],
  phone: '(555) 234-8901',
  website: 'https://thegoldennoodle.com',
  address: '142 Main St, Portland, OR 97201',
  hours: {
    Mon: { open: '11:00', close: '21:00', closed: false },
    Tue: { open: '11:00', close: '21:00', closed: false },
    Wed: { open: '11:00', close: '21:00', closed: false },
    Thu: { open: '11:00', close: '22:00', closed: false },
    Fri: { open: '11:00', close: '22:00', closed: false },
    Sat: { open: '10:00', close: '22:00', closed: false },
    Sun: { open: '10:00', close: '20:00', closed: false },
  },
  rating: 4.2,
  reviewCount: 87,
}

export const keywordSuggestions: KeywordSuggestion[] = [
  { id: 'k1', keyword: 'thai food near me', searchVolume: 'high', relevance: 95, currentlyUsed: true },
  { id: 'k2', keyword: 'best pad thai', searchVolume: 'high', relevance: 92, currentlyUsed: false },
  { id: 'k3', keyword: 'thai restaurant downtown', searchVolume: 'high', relevance: 88, currentlyUsed: true },
  { id: 'k4', keyword: 'asian noodles delivery', searchVolume: 'medium', relevance: 82, currentlyUsed: false },
  { id: 'k5', keyword: 'thai curry restaurant', searchVolume: 'medium', relevance: 78, currentlyUsed: false },
  { id: 'k6', keyword: 'local thai cuisine', searchVolume: 'medium', relevance: 74, currentlyUsed: false },
  { id: 'k7', keyword: 'authentic pad thai', searchVolume: 'low', relevance: 70, currentlyUsed: false },
  { id: 'k8', keyword: 'thai lunch special', searchVolume: 'high', relevance: 85, currentlyUsed: true },
]

export const competitors: Competitor[] = [
  {
    id: 'c1',
    name: 'Pho 99',
    rating: 4.5,
    reviewCount: 203,
    profileCompleteness: 85,
    distance: '0.3 mi',
    topCategories: ['Vietnamese Restaurant', 'Pho'],
  },
  {
    id: 'c2',
    name: 'Sakura Garden',
    rating: 4.3,
    reviewCount: 156,
    profileCompleteness: 72,
    distance: '0.5 mi',
    topCategories: ['Japanese Restaurant', 'Sushi'],
  },
  {
    id: 'c3',
    name: 'Wok & Roll',
    rating: 4.1,
    reviewCount: 98,
    profileCompleteness: 61,
    distance: '0.7 mi',
    topCategories: ['Chinese Restaurant', 'Noodles'],
  },
]

export const photoStatus: PhotoStatus = {
  total: 12,
  byCategory: [
    { category: 'Exterior', count: 4 },
    { category: 'Interior', count: 3 },
    { category: 'Products', count: 3 },
    { category: 'Team', count: 2 },
  ],
  lastAdded: '2026-07-25',
  recommendation:
    'Add more food photos (especially signature dishes) and consider a short video of the dining area. Listings with 20+ photos get 35% more clicks.',
}

export const seoScore: SeoScore = {
  overall: 70,
  categories: [
    { name: 'Profile Completeness', score: 85, weight: 25 },
    { name: 'Photos', score: 60, weight: 20 },
    { name: 'Reviews', score: 75, weight: 25 },
    { name: 'Keywords', score: 55, weight: 15 },
    { name: 'NAP Consistency', score: 70, weight: 15 },
  ],
}

export const quickLinks: QuickLink[] = [
  { id: 'ql1', label: 'View on Google', href: 'https://search.google.com/local/writereview?placeid=ChIJGblnVa655zsRtRfkePjHE8E', external: true },
  { id: 'ql2', label: 'Review Inbox', href: '/reviews/inbox', external: false },
  { id: 'ql3', label: 'Request Reviews', href: '/reviews/new', external: false },
  { id: 'ql4', label: 'Share Profile', href: '#', external: false },
]

export const seoActionItems: ActionItemData[] = [
  {
    id: 'seo-1',
    title: 'Add 5 new food photos',
    description: 'Listings with 10+ photos get 52% more calls. Upload high-quality images of your signature dishes.',
    status: 'high-priority',
    icon: Camera,
    actionLabel: 'Upload Photos',
    actionType: 'primary',
  },
  {
    id: 'seo-2',
    title: 'Update business description with keywords',
    description: 'Your description is missing 4 high-volume keywords identified by AI analysis.',
    status: 'high-priority',
    icon: PenLine,
    actionLabel: 'Edit Description',
    actionType: 'primary',
  },
  {
    id: 'seo-3',
    title: 'Add "Online Ordering" attribute',
    description: 'Competitors Pho 99 and Sakura Garden both show this attribute. It increases visibility by 15%.',
    status: 'pending',
    icon: Globe,
    actionLabel: 'Add Attribute',
    actionType: 'primary',
  },
  {
    id: 'seo-4',
    title: 'Fix inconsistent phone number',
    description: 'Your website shows (555) 234-8901 but directories list (555) 234-8902.',
    status: 'high-priority',
    icon: Tag,
    actionLabel: 'Fix Now',
    actionType: 'primary',
  },
  {
    id: 'seo-5',
    title: 'Respond to 3 unanswered reviews',
    description: 'Responding to reviews improves engagement and signals active management to Google.',
    status: 'pending',
    icon: FileText,
    actionLabel: 'Go to Inbox',
    actionType: 'primary',
  },
  {
    id: 'seo-6',
    title: 'Update holiday hours for Labor Day',
    description: 'Your hours for Sep 1 show default times. Mark early closure or update hours.',
    status: 'pending',
    icon: Clock,
    actionLabel: 'Update Hours',
    actionType: 'secondary',
  },
  {
    id: 'seo-7',
    title: 'Add 2 new product photos',
    description: 'Your menu items section is underrepresented. Add photos of popular dishes.',
    status: 'completed',
    icon: ImagePlus,
    actionLabel: 'Uploaded',
    actionType: 'secondary',
  },
  {
    id: 'seo-8',
    title: 'Claim and verify address listing',
    description: 'Address verified on Nov 12, 2025. All directories now match.',
    status: 'completed',
    icon: CheckCircle2,
    actionLabel: 'Verified',
    actionType: 'secondary',
  },
]

export const VOLUME_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  low: { bg: 'bg-slate-100', text: 'text-slate-600' },
}
