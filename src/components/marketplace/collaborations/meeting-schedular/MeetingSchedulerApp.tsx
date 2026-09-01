import { createSignal, createResource, Show } from "solid-js";
import { ChevronDown, Copy, Link2, Video, Settings, ExternalLink } from "lucide-solid";
import SegmentControl from "./SegmentControl";
import UpcomingMeetings from "./UpcomingMeetings";
import WeeklyCalendar from "./WeeklyCalendar";
import LoadOverview from "./LoadOverview";
import BookableWindows from "./BookableWindows";
import ScheduleSettingsModal from "./ScheduleSettingsModal";
import { APP_DOMAIN } from "~/lib/constants";

async function fetchScheduleSettings() {
  try {
    const res = await fetch("/api/marketplace/schedule-settings");
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings as {
      username?: string | null;
      workingDays: string;
      workingStartTime: string;
      workingEndTime: string;
      bookingStartTime: string;
      bookingEndTime: string;
      slotDuration: number;
      timezone: string;
    };
  } catch {
    return null;
  }
}

function MeetingSchedulerApp() {
  const [settings, { refetch: refetchSettings }] = createResource(fetchScheduleSettings);
  const [view, setView] = createSignal<"upcoming" | "availability">("upcoming");
  const [weekOffset, setWeekOffset] = createSignal(0);
  const [linkMenuOpen, setLinkMenuOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [scheduleCopied, setScheduleCopied] = createSignal(false);
  const [creatingMeet, setCreatingMeet] = createSignal(false);
  const [meetCopied, setMeetCopied] = createSignal(false);
  const [meetError, setMeetError] = createSignal("");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [slotsVersion, setSlotsVersion] = createSignal(0);

  const copyLink = async () => {
    const url = `${APP_DOMAIN}/marketplace`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const copyScheduleLink = async () => {
    const username = settings()?.username;
    const url = username
      ? `${APP_DOMAIN}/company/${encodeURIComponent(username)}/bookings`
      : `${APP_DOMAIN}/marketplace`;
    await navigator.clipboard?.writeText(url);
    setScheduleCopied(true);
    setTimeout(() => setScheduleCopied(false), 1600);
  };

  const openSchedulePreview = () => {
    const username = settings()?.username;
    if (username) {
      window.open(`/company/${encodeURIComponent(username)}/bookings`, "_blank");
    }
  };

  const copyMeetLink = async () => {
    setCreatingMeet(true);
    setMeetError("");
    setMeetCopied(false);
    try {
      const res = await fetch("/api/meet/create");
      const data = await res.json();
      if (!res.ok) {
        setMeetError(data.error || "Failed to create Meet link");
        return;
      }
      await navigator.clipboard?.writeText(data.meetUri);
      setMeetCopied(true);
      setTimeout(() => setMeetCopied(false), 1600);
    } catch {
      setMeetError("Failed to create Meet link");
    } finally {
      setCreatingMeet(false);
    }
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Settings class="size-4" />
              IST Schedule Settings
            </button>
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
                <div class="absolute right-0 z-20 mt-2 w-full min-w-64 rounded-lg border border-border bg-popover p-2 shadow-md">
                  <button
                    type="button"
                    onClick={copyScheduleLink}
                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Copy class="size-4 text-muted-foreground" />
                    {scheduleCopied() ? "Schedule link copied" : "Copy public schedule link"}
                  </button>
                  <Show when={settings()?.username}>
                    <button
                      type="button"
                      onClick={openSchedulePreview}
                      class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <ExternalLink class="size-4 text-muted-foreground" />
                      Preview public schedule
                    </button>
                  </Show>
                  <button
                    type="button"
                    onClick={copyMeetLink}
                    disabled={creatingMeet()}
                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <Video class="size-4 text-muted-foreground" />
                    {creatingMeet()
                      ? "Creating..."
                      : meetCopied()
                        ? "Meet link copied"
                        : "Copy Google Meet link"}
                  </button>
                  <Show when={meetError()}>
                    <p class="px-3 pt-1 text-xs text-destructive">{meetError()}</p>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </header>

        <Show
          when={view() === "upcoming"}
          fallback={
            <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
              <BookableWindows key={slotsVersion()} />
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
              <BookableWindows key={slotsVersion()} />
            </aside>
          </div>
        </Show>
      </div>

      <ScheduleSettingsModal
        open={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setSlotsVersion((v) => v + 1)}
      />
    </main>
  );
}

export default MeetingSchedulerApp;
