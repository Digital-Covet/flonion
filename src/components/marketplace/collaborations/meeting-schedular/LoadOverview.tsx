import { Gauge, Info, Lightbulb } from "lucide-solid";
import { createResource, Show, Suspense } from "solid-js";
import { Skeleton } from "~/components/ui/skeleton";
import LoadBar from "./LoadBar";
import SectionShell from "./SectionShell";

async function fetchLoad() {
  if (typeof window === "undefined") return null;
  const res = await fetch("/api/marketplace/load");
  if (!res.ok) throw new Error("Failed to load");
  return res.json() as Promise<{
    thisWeek: { value: number; detail: string; tone: "orange" | "primary" };
    nextWeek: { value: number; detail: string; tone: "orange" | "primary" };
    tip: string;
  }>;
}

/**
 * Flonion DS §6: load overview as bars with numbers. Per-widget skeleton
 * and error — one slow widget never blocks the page.
 */
function LoadOverview() {
  const [load, { refetch }] = createResource(fetchLoad);

  return (
    <SectionShell class="p-5">
      <div class="mb-1 flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Gauge class="size-5 text-primary" aria-hidden="true" />
          Load Overview
        </h2>
        <Info
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <p class="mb-5 text-sm leading-6 text-muted-foreground">
        Your capacity for the next 14 days based on connected calendars.
      </p>
      <Suspense
        fallback={
          <div class="grid gap-4" aria-hidden="true">
            <div class="grid gap-1.5">
              <div class="flex justify-between">
                <Skeleton class="h-3 w-20" />
                <Skeleton class="h-3 w-16" />
              </div>
              <Skeleton class="h-2 w-full rounded-full" />
            </div>
            <div class="grid gap-1.5">
              <div class="flex justify-between">
                <Skeleton class="h-3 w-20" />
                <Skeleton class="h-3 w-16" />
              </div>
              <Skeleton class="h-2 w-full rounded-full" />
            </div>
          </div>
        }
      >
        <Show
          when={!load.error}
          fallback={
            <div role="alert" class="grid gap-2">
              <p class="text-sm text-destructive">
                Couldn't load capacity. Other sections are unaffected.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                class="inline-flex min-h-11 w-fit items-center rounded-control border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Retry
              </button>
            </div>
          }
        >
          <div class="grid gap-4">
            <Show
              when={load.latest}
              fallback={
                <div class="grid gap-4" aria-hidden="true">
                  <div class="grid gap-1.5">
                    <div class="flex justify-between">
                      <Skeleton class="h-3 w-20" />
                      <Skeleton class="h-3 w-16" />
                    </div>
                    <Skeleton class="h-2 w-full rounded-full" />
                  </div>
                  <div class="grid gap-1.5">
                    <div class="flex justify-between">
                      <Skeleton class="h-3 w-20" />
                      <Skeleton class="h-3 w-16" />
                    </div>
                    <Skeleton class="h-2 w-full rounded-full" />
                  </div>
                </div>
              }
            >
              {(data) => (
                <>
                  <LoadBar
                    label="This Week"
                    value={data().thisWeek.value}
                    detail={data().thisWeek.detail}
                    tone={data().thisWeek.tone}
                  />
                  <LoadBar
                    label="Next Week"
                    value={data().nextWeek.value}
                    detail={data().nextWeek.detail}
                    tone={data().nextWeek.tone}
                  />
                </>
              )}
            </Show>
          </div>
          <div class="mt-5 flex items-start gap-3 rounded-card border border-secondary/25 bg-secondary/10 p-3.5">
            <Lightbulb
              class="mt-0.5 size-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <p class="text-sm leading-5 text-foreground" aria-live="polite">
              {load.latest ? load.latest.tip : "Loading schedule data…"}
            </p>
          </div>
        </Show>
      </Suspense>
    </SectionShell>
  );
}

export default LoadOverview;
