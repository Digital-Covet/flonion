import { clientOnly } from "@solidjs/start";
import { Suspense } from "solid-js";

const MeetingSchedulerApp = clientOnly(
  () =>
    import(
      "~/components/marketplace/collaborations/meeting-schedular/MeetingSchedulerApp"
    ),
);

/**
 * DS §2 + §5 (E3): loading mirrors the loaded scheduler layout — header +
 * two card skeletons with `rounded-card` radius and the shared `.skeleton`
 * pulse. Never a bare spinner box.
 */
function SchedulerFallback() {
  return (
    <main class="mx-auto min-h-screen w-full max-w-7xl bg-background p-4 sm:p-6">
      <div role="status" aria-label="Loading meeting scheduler">
        <span class="sr-only">Loading meeting scheduler…</span>
        <header class="mb-6 flex flex-col gap-4" aria-hidden="true">
          <div class="skeleton h-4 w-32 rounded-control" />
          <div class="skeleton h-10 w-64 rounded-control" />
          <div class="skeleton h-5 w-full max-w-xl rounded-control" />
          <div class="flex flex-col gap-2.5 sm:flex-row">
            <div class="skeleton h-11 w-56 rounded-card" />
            <div class="skeleton h-11 w-44 rounded-control" />
            <div class="skeleton h-11 w-44 rounded-control" />
          </div>
        </header>
        <div class="grid gap-4 lg:grid-cols-3" aria-hidden="true">
          <div class="rounded-card border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <div class="skeleton h-5 w-40 rounded-control" />
            <div class="mt-4 grid grid-cols-7 gap-1">
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
              <div class="skeleton h-16 rounded-control" />
            </div>
          </div>
          <div class="rounded-card border border-border bg-card p-5 shadow-sm">
            <div class="skeleton h-5 w-32 rounded-control" />
            <div class="mt-4 grid gap-2">
              <div class="skeleton h-16 rounded-card" />
              <div class="skeleton h-16 rounded-card" />
              <div class="skeleton h-16 rounded-card" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function MeetingSchedulerPage() {
  return (
    <Suspense fallback={<SchedulerFallback />}>
      <MeetingSchedulerApp fallback={<SchedulerFallback />} />
    </Suspense>
  );
}
