import { Dialog } from "@ark-ui/solid/dialog";
import { Calendar, Clock, Loader2, X } from "lucide-solid";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { notify } from "~/components/ui/toast";
import { tzLabel } from "~/lib/timezone-label";

interface ScheduleSettings {
  workingDays: string;
  workingStartTime: string;
  workingEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
  timezone: string;
}

const DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
];

async function fetchSettings(): Promise<ScheduleSettings> {
  const res = await fetch("/api/marketplace/schedule-settings");
  if (!res.ok) {
    return {
      workingDays: "1,2,3,4,5",
      workingStartTime: "09:00",
      workingEndTime: "18:00",
      bookingStartTime: "14:00",
      bookingEndTime: "17:00",
      slotDuration: 30,
      timezone: "Asia/Kolkata",
    };
  }
  const data = await res.json();
  return data.settings;
}

interface ScheduleSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Flonion DS §6: settings dialog with labelled sections, 44px targets,
 * `aria-pressed` day/duration toggles, timezone always shown, E2 motion.
 */
function ScheduleSettingsModal(props: ScheduleSettingsModalProps) {
  const [settings] = createResource(fetchSettings);
  const [workingDays, setWorkingDays] = createSignal<number[]>([1, 2, 3, 4, 5]);
  const [workingStart, setWorkingStart] = createSignal("09:00");
  const [workingEnd, setWorkingEnd] = createSignal("18:00");
  const [bookingStart, setBookingStart] = createSignal("14:00");
  const [bookingEnd, setBookingEnd] = createSignal("17:00");
  const [duration, setDuration] = createSignal(30);
  const [saving, setSaving] = createSignal(false);
  const [generating, setGenerating] = createSignal(false);
  const [statusMsg, setStatusMsg] = createSignal("");
  const [statusTone, setStatusTone] = createSignal<"ok" | "error">("ok");

  createEffect(() => {
    const s = settings();
    if (s) applySettings(s);
  });

  const applySettings = (s: ScheduleSettings) => {
    setWorkingDays(
      s.workingDays
        .split(",")
        .map(Number)
        .filter((d) => !Number.isNaN(d)),
    );
    setWorkingStart(s.workingStartTime);
    setWorkingEnd(s.workingEndTime);
    setBookingStart(s.bookingStartTime);
    setBookingEnd(s.bookingEndTime);
    setDuration(s.slotDuration);
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    );
  };

  const payload = () => ({
    workingDays: workingDays(),
    workingStartTime: workingStart(),
    workingEndTime: workingEnd(),
    bookingStartTime: bookingStart(),
    bookingEndTime: bookingEnd(),
    slotDuration: duration(),
  });

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/marketplace/schedule-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatusTone("error");
        setStatusMsg(data.error || "Failed to save settings");
        return;
      }
      setStatusTone("ok");
      setStatusMsg("Settings saved successfully");
      notify("success", "Schedule settings saved");
      props.onSaved();
    } catch {
      setStatusTone("error");
      setStatusMsg("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setStatusMsg("");
    try {
      const saveRes = await fetch("/api/marketplace/schedule-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!saveRes.ok) {
        setStatusTone("error");
        setStatusMsg("Failed to save settings");
        return;
      }

      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 30);

      const formatDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const genRes = await fetch("/api/marketplace/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: formatDate(today),
          endDate: formatDate(end),
        }),
      });

      if (!genRes.ok) {
        const data = await genRes.json();
        setStatusTone("error");
        setStatusMsg(data.error || "Failed to generate slots");
        return;
      }

      const data = await genRes.json();
      setStatusTone("ok");
      setStatusMsg(
        `Settings saved. ${data.created} slots generated for the next 30 days.`,
      );
      notify("success", "Slots generated");
      props.onSaved();
    } catch {
      setStatusTone("error");
      setStatusMsg("Failed to generate slots");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => {
        if (!details.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Content class="e2-enter flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-soft border border-border bg-card shadow-lg sm:rounded-card">
            <header class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid size-10 shrink-0 place-items-center rounded-card bg-primary/10">
                  <Clock class="size-5 text-primary" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <Dialog.Title class="font-heading text-lg font-semibold text-foreground">
                    Schedule Settings
                  </Dialog.Title>
                  <Dialog.Description class="tnum truncate text-xs text-muted-foreground">
                    {tzLabel(settings.latest?.timezone)}
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.CloseTrigger
                aria-label="Close schedule settings"
                class="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X class="size-5" aria-hidden="true" />
              </Dialog.CloseTrigger>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <Show
                when={!settings.loading}
                fallback={
                  <div
                    class="flex items-center justify-center py-10"
                    role="status"
                    aria-label="Loading settings"
                  >
                    <Loader2
                      class="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  </div>
                }
              >
                <fieldset class="mb-5">
                  <legend class="mb-2 block text-sm font-medium text-foreground">
                    Working Days
                  </legend>
                  <div class="flex flex-wrap gap-2">
                    <For each={DAY_LABELS}>
                      {(day) => {
                        const active = () => workingDays().includes(day.value);
                        return (
                          <button
                            type="button"
                            aria-pressed={active()}
                            onClick={() => toggleDay(day.value)}
                            class={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3.5 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                              active()
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </fieldset>

                <fieldset class="mb-5">
                  <legend class="mb-2 block text-sm font-medium text-foreground">
                    Working Hours ({tzLabel(settings.latest?.timezone)})
                  </legend>
                  <div class="flex items-center gap-3">
                    <input
                      type="time"
                      aria-label="Working hours start"
                      value={workingStart()}
                      onInput={(e) => setWorkingStart(e.currentTarget.value)}
                      class="tnum min-h-11 flex-1 rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                    <span class="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      aria-label="Working hours end"
                      value={workingEnd()}
                      onInput={(e) => setWorkingEnd(e.currentTarget.value)}
                      class="tnum min-h-11 flex-1 rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                </fieldset>

                <fieldset class="mb-5">
                  <legend class="mb-2 block text-sm font-medium text-foreground">
                    Booking Time Window ({tzLabel(settings.latest?.timezone)})
                  </legend>
                  <p class="mb-2 text-xs leading-5 text-muted-foreground">
                    Only these hours will be shown as available to visitors.
                  </p>
                  <div class="flex items-center gap-3">
                    <input
                      type="time"
                      aria-label="Booking window start"
                      value={bookingStart()}
                      onInput={(e) => setBookingStart(e.currentTarget.value)}
                      class="tnum min-h-11 flex-1 rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                    <span class="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      aria-label="Booking window end"
                      value={bookingEnd()}
                      onInput={(e) => setBookingEnd(e.currentTarget.value)}
                      class="tnum min-h-11 flex-1 rounded-control border border-control bg-card px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                </fieldset>

                <fieldset class="mb-2">
                  <legend class="mb-2 block text-sm font-medium text-foreground">
                    Slot Duration
                  </legend>
                  <div class="flex flex-wrap gap-2">
                    <For each={DURATION_OPTIONS}>
                      {(opt) => {
                        const active = () => duration() === opt.value;
                        return (
                          <button
                            type="button"
                            aria-pressed={active()}
                            onClick={() => setDuration(opt.value)}
                            class={`inline-flex min-h-11 items-center justify-center rounded-control px-4 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                              active()
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </fieldset>

                <Show when={statusMsg()}>
                  <div
                    role={statusTone() === "error" ? "alert" : "status"}
                    class={`tnum mt-4 rounded-card px-3.5 py-2.5 text-sm ${
                      statusTone() === "error"
                        ? "bg-destructive-muted text-destructive"
                        : "bg-success-muted text-success"
                    }`}
                  >
                    {statusMsg()}
                  </div>
                </Show>
              </Show>
            </div>

            <footer class="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5">
              <Dialog.CloseTrigger class="inline-flex min-h-11 items-center justify-center rounded-control px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Cancel
              </Dialog.CloseTrigger>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving()}
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-border disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {saving() && (
                  <Loader2
                    class="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating() || saving()}
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {(generating() || saving()) && (
                  <Loader2
                    class="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                <Calendar class="size-4" aria-hidden="true" />
                Save & Generate Slots
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export default ScheduleSettingsModal;
