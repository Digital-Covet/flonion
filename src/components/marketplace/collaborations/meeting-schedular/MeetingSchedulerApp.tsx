import { Menu } from "@ark-ui/solid/menu";
import {
  CalendarDays,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Settings,
  Video,
} from "lucide-solid";
import { createResource, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { notify } from "~/components/ui/toast";
import { currentOrigin } from "~/lib/constants";
import { tzLabel } from "~/lib/timezone-label";
import BookableWindows from "./BookableWindows";
import LoadOverview from "./LoadOverview";
import ScheduleSettingsModal from "./ScheduleSettingsModal";
import SegmentControl from "./SegmentControl";
import UpcomingMeetings from "./UpcomingMeetings";
import WeeklyCalendar from "./WeeklyCalendar";

async function fetchScheduleSettings() {
  if (typeof window === "undefined") return null;
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

/**
 * Flonion DS §6 — Meeting Scheduler.
 * - App container max 1280, medium density, H1 + timezone.
 * - View switch (Upcoming / Availability) stays a segment; content
 *   filters live in UpcomingMeetings as icon chips.
 * - Week grid on `lg`, agenda list below `md` (see WeeklyCalendar).
 * - Load overview as bars with numbers (see LoadOverview).
 * - All actions 44px+, 2px primary focus, E1 motion, toasts on save.
 */
function MeetingSchedulerApp() {
  const [settings] = createResource(fetchScheduleSettings);
  const [view, setView] = createSignal<"upcoming" | "availability">("upcoming");
  const [weekOffset, setWeekOffset] = createSignal(0);
  const [scheduleCopied, setScheduleCopied] = createSignal(false);
  const [creatingMeet, setCreatingMeet] = createSignal(false);
  const [meetCopied, setMeetCopied] = createSignal(false);
  const [meetError, setMeetError] = createSignal("");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [slotsVersion, setSlotsVersion] = createSignal(0);

  const copyScheduleLink = async () => {
    const username = settings.latest?.username;
    const origin = currentOrigin();
    const url = username
      ? `${origin}/company/${encodeURIComponent(username)}/bookings`
      : `${origin}/marketplace`;
    try {
      await navigator.clipboard?.writeText(url);
      setScheduleCopied(true);
      notify("success", "Schedule link copied");
      setTimeout(() => setScheduleCopied(false), 1600);
    } catch {
      notify("error", "Couldn't copy the link");
    }
  };

  const openSchedulePreview = () => {
    const username = settings.latest?.username;
    if (username) {
      window.open(
        `/company/${encodeURIComponent(username)}/bookings`,
        "_blank",
      );
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
      notify("success", "Meet link copied");
      setTimeout(() => setMeetCopied(false), 1600);
    } catch {
      setMeetError("Failed to create Meet link");
      notify("error", "Failed to create Meet link");
    } finally {
      setCreatingMeet(false);
    }
  };

  return (
    <main class="e1-enter mx-auto min-h-screen w-full max-w-7xl bg-background p-4 sm:p-6">
      <header class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="flex items-center gap-1.5 text-xs font-medium tracking-wide text-secondary uppercase">
            <CalendarDays class="size-3.5" aria-hidden="true" />
            Collaborations
          </p>
          <h1 class="mt-1 font-heading text-3xl font-semibold text-foreground">
            Meeting Scheduler
          </h1>
          <p class="tnum mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Manage your availability and upcoming collaborative sessions ·{" "}
            {tzLabel(settings.latest?.timezone)}
          </p>
        </div>
        <div class="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
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
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Settings class="size-4" aria-hidden="true" />
            Schedule Settings
          </button>
          <Menu.Root>
            <Menu.Trigger class="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Link2 class="size-4" aria-hidden="true" />
              Share Booking Link
              <ChevronDown class="size-4" aria-hidden="true" />
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content class="z-50 min-w-64 rounded-card border border-border bg-popover p-1.5 shadow-lg">
                  <Menu.Item
                    value="copy-schedule"
                    onSelect={() => void copyScheduleLink()}
                    class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Copy
                      class="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {scheduleCopied()
                      ? "Schedule link copied"
                      : "Copy public schedule link"}
                  </Menu.Item>
                  <Show when={settings.latest?.username}>
                    <Menu.Item
                      value="preview"
                      onSelect={openSchedulePreview}
                      class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <ExternalLink
                        class="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Preview public schedule
                    </Menu.Item>
                  </Show>
                  <Menu.Item
                    value="meet"
                    disabled={creatingMeet()}
                    onSelect={() => void copyMeetLink()}
                    class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Video
                      class="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {creatingMeet()
                      ? "Creating…"
                      : meetCopied()
                        ? "Meet link copied"
                        : "Copy Google Meet link"}
                  </Menu.Item>
                  <Show when={meetError()}>
                    <p role="alert" class="px-3 pt-1 text-xs text-destructive">
                      {meetError()}
                    </p>
                  </Show>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </div>
      </header>

      <Show
        when={view() === "upcoming"}
        fallback={
          <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
            <BookableWindows
              key={slotsVersion()}
              timezone={settings.latest?.timezone}
            />
            <LoadOverview />
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <UpcomingMeetings />
            <WeeklyCalendar
              weekOffset={weekOffset()}
              timezone={settings.latest?.timezone}
              onWeekChange={(change) =>
                setWeekOffset((offset) =>
                  Math.max(-4, Math.min(4, offset + change)),
                )
              }
            />
          </div>
          <aside class="flex min-w-0 flex-col gap-6">
            <LoadOverview />
            <BookableWindows
              key={slotsVersion()}
              timezone={settings.latest?.timezone}
            />
          </aside>
        </div>
      </Show>

      <ScheduleSettingsModal
        open={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setSlotsVersion((v) => v + 1)}
      />
    </main>
  );
}

export default MeetingSchedulerApp;
