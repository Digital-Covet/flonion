export interface DayHours {
  open: string
  close: string
  closed: boolean
}

export interface BusinessInfo {
  name: string
  description: string
  categories: string[]
  phone: string
  website: string
  address: string
  hours: Record<string, DayHours>
  rating: number
  reviewCount: number
  reviewLink: string
  reviewLinks?: Record<string, string>
}

export type SearchVolume = 'high' | 'medium' | 'low'

export interface KeywordSuggestion {
  id: string
  keyword: string
  searchVolume: SearchVolume
  relevance: number
  currentlyUsed: boolean
}

export interface Competitor {
  id: string
  name: string
  rating: number
  reviewCount: number
  profileCompleteness: number
  distance: string
  topCategories: string[]
}

export interface PhotoCategory {
  category: string
  count: number
}

export interface PhotoStatus {
  total: number
  byCategory: PhotoCategory[]
  lastAdded: string
  recommendation: string
}

export interface SeoScoreCategory {
  name: string
  score: number
  weight: number
}

export interface SeoScore {
  overall: number
  categories: SeoScoreCategory[]
}

export interface QuickLink {
  id: string
  label: string
  href: string
  external: boolean
}
