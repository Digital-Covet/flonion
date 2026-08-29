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

export type MeetingFilter = "all" | "partner" | "team"
export type MeetingStatus = "Confirmed" | "Pending"
export type BadgeTone = "primary" | "orange" | "purple"
export type CalendarEventTone = "muted" | "primary" | "orange"

export interface Meeting {
  id: string | number
  month: string
  day: string
  title: string
  time: string
  location: string
  locationIcon: IconComponent
  category: "partner" | "team"
  status: MeetingStatus
  participants: string[]
  rawStatus?: string
  requesterName?: string
}

export interface SegmentControlOption<T extends string> {
  label: string
  value: T
}

export interface SegmentControlProps<T extends string> {
  options: SegmentControlOption<T>[]
  value: T
  onChange: (value: T) => void
  compact?: boolean
}

export interface StatusBadgeProps {
  children: import("solid-js").JSX.Element
  tone: BadgeTone
}

export interface AvatarGroupProps {
  participants: string[]
}

export interface MeetingRowProps {
  meeting: Meeting
  delay: number
}

export interface CalendarEventProps {
  class?: string
  style?: Record<string, string | number>
  children: import("solid-js").JSX.Element
  tone?: CalendarEventTone
}

export interface LoadBarProps {
  label: string
  value: number
  detail: string
  tone: "orange" | "primary"
}

export interface AvailabilityWindowProps {
  title: string
  schedule: string
  active: boolean
  onToggle: () => void
}

export interface BookableWindow {
  id: number
  title: string
  schedule: string
  active: boolean
}

export interface SectionShellProps {
  children: import("solid-js").JSX.Element
  class?: string
}
