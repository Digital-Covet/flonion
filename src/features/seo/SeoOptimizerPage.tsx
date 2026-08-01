import { Title } from '@solidjs/meta'
import { For, Show } from 'solid-js'
import Activity from 'lucide-solid/icons/activity'
import TrendingUp from 'lucide-solid/icons/trending-up'
import TrendingDown from 'lucide-solid/icons/trending-down'
import PageHeader from '~/components/seo/PageHeader'
import ProgressTracker from '~/components/seo/ProgressTracker'
import ActionList from '~/components/seo/ActionList'
import BusinessInfoCard from '~/components/seo/BusinessInfoCard'
import KeywordRecommendations from '~/components/seo/KeywordRecommendations'
import CompetitorCard from '~/components/seo/CompetitorCard'
import PhotoStatusCard from '~/components/seo/PhotoStatusCard'
import {
  SEO_PAGE_HEADER,
  businessInfo,
  keywordSuggestions,
  competitors,
  photoStatus,
  seoScore,
  seoKpiStats,
  seoActionItems,
  scoreColor,
  type KpiStat,
} from './seo-data'

function ScoreBreakdown() {
  return (
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
          <Activity size={20} />
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-900">Score Breakdown</h3>
          <p class="text-xs text-slate-500">Individual category scores (unweighted)</p>
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
                  class={`h-full rounded-full transition-all ${scoreColor(cat.score)}`}
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

function StatCard(props: { stat: KpiStat }) {
  return (
    <div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class={`flex size-12 items-center justify-center rounded-xl ${props.stat.accent ?? 'bg-slate-100 text-slate-600'}`}>
        <props.stat.icon size={22} />
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-900">{props.stat.value}</p>
        <p class="text-xs text-slate-500">{props.stat.label}</p>
        <Show when={props.stat.trend}>
          <span
            class={`flex items-center gap-1 text-[11px] font-semibold ${props.stat.trend!.direction === 'positive'
                ? 'text-emerald-600'
                : props.stat.trend!.direction === 'negative'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
          >
            <Show
              when={props.stat.trend!.direction === 'positive'}
              fallback={<TrendingDown size={11} />}
            >
              <TrendingUp size={11} />
            </Show>
            {props.stat.trend!.value}
          </span>
        </Show>
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

        <ProgressTracker
          value={seoScore.overall}
          title="Overall SEO Score"
          description="Weighted composite of all ranking factors below. Completing the recommended actions will increase your visibility."
        />

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <For each={seoKpiStats}>
            {(stat) => <StatCard stat={stat} />}
          </For>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <BusinessInfoCard info={businessInfo} />
          </div>
          <div class="lg:col-span-2">
            <PhotoStatusCard status={photoStatus} />
          </div>
        </div>

        <KeywordRecommendations keywords={keywordSuggestions} />

        <CompetitorCard competitors={competitors} />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <ActionList items={seoActionItems} />
          </div>
          <ScoreBreakdown />
        </div>
      </div>
    </>
  )
}
