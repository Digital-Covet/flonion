import { Info, Lightbulb } from "lucide-solid";
import { createResource, Show } from "solid-js";
import SectionShell from "./SectionShell";
import LoadBar from "./LoadBar";

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

function LoadOverview() {
  const [load] = createResource(fetchLoad);

  return (
    <SectionShell class="p-5">
      <div class="mb-3 flex items-center justify-between">
        <h3>Load Overview</h3>
        <Info class="size-4 text-muted-foreground" />
      </div>
      <p class="mb-6 text-sm leading-6 text-muted-foreground">
        Your capacity for the next 14 days based on connected calendars.
      </p>
      <div class="space-y-4">
        <Show when={load()} fallback={<>
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs"><span class="skeleton h-3 w-16" /><span class="skeleton h-3 w-12" /></div>
            <div class="skeleton h-2 w-full rounded-full" />
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs"><span class="skeleton h-3 w-16" /><span class="skeleton h-3 w-12" /></div>
            <div class="skeleton h-2 w-full rounded-full" />
          </div>
        </>}>
          {(data) => <>
            <LoadBar label="This Week" value={data().thisWeek.value} detail={data().thisWeek.detail} tone={data().thisWeek.tone} />
            <LoadBar label="Next Week" value={data().nextWeek.value} detail={data().nextWeek.detail} tone={data().nextWeek.tone} />
          </>}
        </Show>
      </div>
      <div class="mt-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-positive-muted p-3">
        <Lightbulb class="mt-0.5 size-4 shrink-0 text-primary" />
        <p class="text-sm leading-5 text-foreground">
          {load() ? load()!.tip : "Loading schedule data..."}
        </p>
      </div>
    </SectionShell>
  );
}

export default LoadOverview;
