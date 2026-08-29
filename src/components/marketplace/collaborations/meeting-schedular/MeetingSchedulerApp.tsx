import { createSignal, Show } from "solid-js";
import { ChevronDown, Copy, Link2 } from "lucide-solid";
import SegmentControl from "./SegmentControl";
import UpcomingMeetings from "./UpcomingMeetings";
import WeeklyCalendar from "./WeeklyCalendar";
import LoadOverview from "./LoadOverview";
import BookableWindows from "./BookableWindows";
import { APP_DOMAIN } from "~/lib/constants";

function MeetingSchedulerApp() {
  const [view, setView] = createSignal<"upcoming" | "availability">("upcoming");
  const [weekOffset, setWeekOffset] = createSignal(0);
  const [linkMenuOpen, setLinkMenuOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const copyLink = async () => {
    const url = `${APP_DOMAIN}/marketplace`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main class="page-enter min-h-screen bg-background px-4 py-8 sm:px-8 lg:px-10">
      <div class="mx-auto max-w-360">
        <header class="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h2>Meeting Scheduler</h2>
            <p class="mt-2 text-sm text-muted-foreground sm:text-base">
              Manage your availability and upcoming collaborative sessions.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentControl
              value={view()}
              onChange={setView}
              options={[
                { label: "Upcoming", value: "upcoming" },
                { label: "Availability", value: "availability" },
              ]}
            />
            <div class="relative">
              <button
                type="button"
                onClick={() => setLinkMenuOpen((open) => !open)}
                aria-expanded={linkMenuOpen()}
                class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
              >
                <Link2 class="size-4" />
                Share Booking Link
                <ChevronDown
                  class={`size-4 transition-transform ${linkMenuOpen() ? "rotate-180" : ""}`}
                />
              </button>
              <Show when={linkMenuOpen()}>
                <div class="absolute right-0 z-20 mt-2 w-full min-w-56 rounded-lg border border-border bg-popover p-2 shadow-md">
                  <button
                    type="button"
                    onClick={copyLink}
                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Copy class="size-4 text-muted-foreground" />
                    {copied() ? "Link copied" : "Copy booking link"}
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </header>

        <Show
          when={view() === "upcoming"}
          fallback={
            <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
              <BookableWindows />
              <LoadOverview />
            </div>
          }
        >
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="flex flex-col gap-6 lg:col-span-2">
              <UpcomingMeetings />
              <WeeklyCalendar
                weekOffset={weekOffset()}
                onWeekChange={(change) =>
                  setWeekOffset((offset) => Math.max(-1, Math.min(1, offset + change)))
                }
              />
            </div>
            <aside class="flex flex-col gap-6">
              <LoadOverview />
              <BookableWindows />
            </aside>
          </div>
        </Show>
      </div>
    </main>
  );
}

export default MeetingSchedulerApp;
