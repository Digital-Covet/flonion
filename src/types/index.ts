import type { Component } from 'solid-js'

export type IconComponent = Component<{
  size?: number | string
  class?: string
  color?: string
  strokeWidth?: number
}>

export type NavId = 'dashboard' | 'reviews-inbox' | 'reviews-new' | 'marketing-seo' | 'marketing-campaigns' | 'settings'

export interface NavItem {
  id: NavId
  label: string
  shortLabel: string
  icon: IconComponent
  href: string
}

export type ActionStatus = 'pending' | 'completed' | 'high-priority'

export type ActionType = 'primary' | 'secondary'

export interface ActionItemData {
  id: string
  title: string
  description: string
  status: ActionStatus
  icon: IconComponent
  actionLabel: string
  actionType: ActionType
}

export interface ProgressData {
  value: number
  title: string
  description: string
}

export interface PageHeaderData {
  title: string
  subtitle: string
}

export interface BrandData {
  title: string
  subtitle: string
  icon: IconComponent
}

export interface Review {
  id: string
  name: string
  initials: string
  ago: string
  source: string
  rating: number
  preview: string
  fullReview?: string
  draftReady?: boolean
  avatarTone: "primary" | "destructive"
  reviewId?: string
  hasReply?: boolean
}
