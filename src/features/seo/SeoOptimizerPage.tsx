import { Title } from '@solidjs/meta'
import { For, Show, createSignal } from 'solid-js'
import Activity from 'lucide-solid/icons/activity'
import Camera from 'lucide-solid/icons/camera'
import Star from 'lucide-solid/icons/star'
import ListChecks from 'lucide-solid/icons/list-checks'
import Zap from 'lucide-solid/icons/zap'
import PageHeader from '~/components/seo/PageHeader'
import ProgressTracker from '~/components/seo/ProgressTracker'
import ActionList from '~/components/seo/ActionList'
import BusinessInfoCard from '~/components/seo/BusinessInfoCard'
import KeywordRecommendations from '~/components/seo/KeywordRecommendations'
import CompetitorCard from '~/components/seo/CompetitorCard'
import PhotoStatusCard from '~/components/seo/PhotoStatusCard'
import QuickLinksCard from '~/components/seo/QuickLinksCard'
import {
  SEO_PAGE_HEADER,
  businessInfo,
  keywordSuggestions,
  competitors,
  photoStatus,
  seoScore,
  quickLinks,
  seoActionItems,
} from './seo-data'
import { ProgressRoot, ProgressCircle, ProgressCircleTrack, ProgressCircleRange } from '~/components/ui/progress'

function ScoreBreakdown() {
  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Activity size={20} />
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-900">Score Breakdown</h3>
          <p class="text-xs text-slate-500">How each factor impacts your ranking</p>
        </div>
      </div>
      <div class="space-y-3">
        <For each={seoScore.categories}>
          {(cat) => (
            <div>
              <div class="mb-1 flex items-center justify-between text-sm">
                <span class="font-medium text-slate-700">{cat.name}</span>
                <span class="text-slate-500">
                  {cat.score}<span class="text-xs text-slate-400"> / 100</span>
                </span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

function StatCard(props: { icon: typeof Camera; label: string; value: string | number; accent?: string }) {
  return (
    <div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class={`flex size-12 items-center justify-center rounded-xl ${props.accent ?? 'bg-slate-100 text-slate-600'}`}>
        <props.icon size={22} />
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-900">{props.value}</p>
        <p class="text-xs text-slate-500">{props.label}</p>
      </div>
    </div>
  )
}

export function SeoOptimizerPage() {
  return (
    <>
      <Title>SEO Optimizer — Cognitive Enterprise</Title>
      <div class="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title={SEO_PAGE_HEADER.title}
          subtitle={SEO_PAGE_HEADER.subtitle}
        />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <ProgressTracker
              value={seoScore.overall}
              title="Profile Optimization Strength"
              description="Your profile is missing key information that could boost local rankings. Completing the recommended actions below will increase your visibility."
            />
          </div>
          <div class="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-2">
            <StatCard
              icon={Camera}
              label="Photos"
              value={photoStatus.total}
              accent="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={Star}
              label="Avg Rating"
              value={businessInfo.rating}
              accent="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={ListChecks}
              label="Actions Open"
              value={seoActionItems.filter((a) => a.status !== 'completed').length}
              accent="bg-rose-50 text-rose-600"
            />
            <StatCard
              icon={Zap}
              label="Reviews"
              value={businessInfo.reviewCount}
              accent="bg-violet-50 text-violet-600"
            />
          </div>
        </div>

        <BusinessInfoCard info={businessInfo} />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <KeywordRecommendations keywords={keywordSuggestions} />
          </div>
          <PhotoStatusCard status={photoStatus} />
        </div>

        <CompetitorCard competitors={competitors} />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <ActionList items={seoActionItems} />
          </div>
          <ScoreBreakdown />
        </div>

        <QuickLinksCard links={quickLinks} />
      </div>
    </>
  )
}
