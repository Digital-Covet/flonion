import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import PlugZap from "lucide-solid/icons/plug-zap";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import ActionList from "~/components/seo/ActionList";
import CompetitorCard from "~/components/seo/CompetitorCard";
import KeywordRecommendations from "~/components/seo/KeywordRecommendations";
import PageHeader from "~/components/seo/PageHeader";
import PhotoStatusCard from "~/components/seo/PhotoStatusCard";
import ProgressTracker from "~/components/seo/ProgressTracker";
import { ButtonLink } from "~/components/ui/button";
import {
  SkeletonChart,
  SkeletonRows,
  WidgetError,
} from "~/components/ui/skeleton";
import {
  competitors,
  keywordSuggestions,
  photoStatus,
  SEO_PAGE_HEADER,
  seoActionItems,
  seoScore,
} from "./seo-data";

/* DS §6 Local SEO: exactly three tabs — Keywords · Competitors · Photos.
   Business profile editing lives in Settings, not here. */
const TABS = [
  { value: "keywords", label: "Keywords" },
  { value: "competitors", label: "Competitors" },
  { value: "photos", label: "Photos" },
] as const;

async function checkGoogle(): Promise<{ connected: boolean }> {
  if (isServer) return { connected: false };
  const res = await fetch("/api/google/status");
  if (!res.ok) throw new Error("Could not reach Google status.");
  const data = await res.json();
  return { connected: Boolean(data.connected) };
}

export function SeoOptimizerPage() {
  const [status, { refetch }] = createResource(checkGoogle);
  const loading = () => status.state === "pending";
  const failed = () => status.state === "errored";
  const connected = () => status()?.connected ?? false;
  const snapshotDate = () => new Date().toISOString().slice(0, 10);

  // Local completion state: tapping an action's deep link marks it done
  // (toast confirms, per DS §6). Persists for the session only.
  const [doneIds, setDoneIds] = createSignal<Set<string>>(
    new Set(
      seoActionItems.filter((a) => a.status === "completed").map((a) => a.id),
    ),
  );
  const items = createMemo(() =>
    seoActionItems.map((a) =>
      doneIds().has(a.id) ? { ...a, status: "completed" as const } : a,
    ),
  );
  const markDone = (id: string) => setDoneIds((prev) => new Set(prev).add(id));

  return (
    <>
      <Title>Local SEO — Flonion</Title>
      <div class="mx-auto max-w-[1280px] space-y-6 px-4 pt-6 pb-10 sm:px-6">
        <PageHeader
          title={SEO_PAGE_HEADER.title}
          subtitle={SEO_PAGE_HEADER.subtitle}
        />

        <Show when={loading()}>
          <div class="grid gap-4" aria-hidden="true">
            <SkeletonChart />
            <SkeletonRows count={4} />
          </div>
        </Show>

        <Show when={failed()}>
          <WidgetError
            message="Live Google data is unavailable — showing the cached snapshot below."
            onRetry={() => refetch()}
            retryLabel="Retry"
          />
        </Show>

        {/* Partial state: Google not connected → score is limited, CTA to connect.
            Cached snapshot still renders below, never a blank page. */}
        <Show when={!loading() && !failed() && !connected()}>
          <div class="flex flex-col gap-3 rounded-card border border-primary/25 bg-positive-muted p-5 sm:flex-row sm:items-center">
            <div class="grid size-10 shrink-0 place-items-center rounded-control bg-primary/10 text-primary">
              <PlugZap size={20} aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-foreground">
                Connect Google for live scores
              </h2>
              <p class="mt-0.5 text-sm text-muted-foreground">
                You're viewing a cached snapshot. Connect your Business Profile
                to refresh keywords, competitors, and photos.
              </p>
            </div>
            <ButtonLink
              href={`/api/google/auth?returnTo=${encodeURIComponent("/marketing/seo")}`}
              rel="external"
            >
              Connect Google
            </ButtonLink>
          </div>
        </Show>

        <Show when={!loading()}>
          {/* 1 — Score header: radial score + words + category breakdown */}
          <ProgressTracker
            value={seoScore.overall}
            title="Profile score"
            description="Weighted composite of the categories below. Completing the action items raises your visibility."
            delta={seoScore.delta}
            deltaLabel={seoScore.deltaLabel}
            categories={seoScore.categories}
          />

          {/* 2 — Action items list (primary content) */}
          <ActionList items={items()} onComplete={markDone} />

          {/* 3 — Detail tabs */}
          <Tabs.Root defaultValue="keywords">
            <Tabs.List
              aria-label="SEO details"
              class="flex gap-2 overflow-x-auto pb-1"
            >
              <For each={TABS}>
                {(tab) => (
                  <Tabs.Trigger
                    value={tab.value}
                    class="h-11 shrink-0 rounded-full border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-opacity duration-180 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[selected]:border-primary data-[selected]:bg-positive-muted data-[selected]:text-primary"
                  >
                    {tab.label}
                  </Tabs.Trigger>
                )}
              </For>
              <Tabs.Indicator class="hidden" />
            </Tabs.List>
            <Tabs.Content value="keywords" class="e1-enter pt-4">
              <KeywordRecommendations keywords={keywordSuggestions} />
            </Tabs.Content>
            <Tabs.Content value="competitors" class="e1-enter pt-4">
              <CompetitorCard competitors={competitors} />
            </Tabs.Content>
            <Tabs.Content value="photos" class="e1-enter pt-4">
              <PhotoStatusCard status={photoStatus} />
            </Tabs.Content>
          </Tabs.Root>

          <p aria-live="polite" class="tnum text-xs text-muted-foreground">
            Cached snapshot · last synced{" "}
            <time dateTime={snapshotDate()}>{snapshotDate()}</time>
          </p>
        </Show>
      </div>
    </>
  );
}
