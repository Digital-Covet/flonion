import { createSignal, createResource, Show, For, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { X, Clock, Calendar, Loader2 } from "lucide-solid";
import SectionShell from "./SectionShell";

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

  onMount(() => {
    const s = settings();
    if (s) applySettings(s);
  });

  const applySettings = (s: ScheduleSettings) => {
    setWorkingDays(s.workingDays.split(",").map(Number).filter((d) => !isNaN(d)));
    setWorkingStart(s.workingStartTime);
    setWorkingEnd(s.workingEndTime);
    setBookingStart(s.bookingStartTime);
    setBookingEnd(s.bookingEndTime);
    setDuration(s.slotDuration);
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/marketplace/schedule-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDays: workingDays(),
          workingStartTime: workingStart(),
          workingEndTime: workingEnd(),
          bookingStartTime: bookingStart(),
          bookingEndTime: bookingEnd(),
          slotDuration: duration(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatusMsg(data.error || "Failed to save settings");
        return;
      }
      setStatusMsg("Settings saved successfully");
      props.onSaved();
    } catch {
      setStatusMsg("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setStatusMsg("");
    try {
      // First save settings
      const saveRes = await fetch("/api/marketplace/schedule-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDays: workingDays(),
          workingStartTime: workingStart(),
          workingEndTime: workingEnd(),
          bookingStartTime: bookingStart(),
          bookingEndTime: bookingEnd(),
          slotDuration: duration(),
        }),
      });
      if (!saveRes.ok) {
        setStatusMsg("Failed to save settings");
        return;
      }

      // Generate slots for next 30 days
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
        setStatusMsg(data.error || "Failed to generate slots");
        return;
      }

      const data = await genRes.json();
      setStatusMsg(`Settings saved. ${data.created} slots generated for the next 30 days.`);
      props.onSaved();
    } catch {
      setStatusMsg("Failed to generate slots");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
          <div class="relative z-10 mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl animate-[fade-in-up_0.2s_ease-out]">
            <header class="flex items-center justify-between border-b border-border px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Clock class="size-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-heading text-lg font-semibold text-foreground">
                    Schedule Settings
                  </h3>
                  <p class="text-xs text-muted-foreground">IST (UTC+5:30)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X class="size-4" />
              </button>
            </header>

            <div class="max-h-[70vh] overflow-y-auto px-6 py-5">
              <Show when={!settings.loading} fallback={
                <div class="flex items-center justify-center py-8">
                  <Loader2 class="size-5 animate-spin text-muted-foreground" />
                </div>
              }>
                {/* Working Days */}
                <div class="mb-5">
                  <label class="mb-2 block text-sm font-medium text-foreground">
                    Working Days
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <For each={DAY_LABELS}>
                      {(day) => (
                        <button
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            workingDays().includes(day.value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {day.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Working Hours */}
                <div class="mb-5">
                  <label class="mb-2 block text-sm font-medium text-foreground">
                    Working Hours (IST)
                  </label>
                  <div class="flex items-center gap-3">
                    <input
                      type="time"
                      value={workingStart()}
                      onInput={(e) => setWorkingStart(e.currentTarget.value)}
                      class="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span class="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={workingEnd()}
                      onInput={(e) => setWorkingEnd(e.currentTarget.value)}
                      class="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Booking Time Window */}
                <div class="mb-5">
                  <label class="mb-2 block text-sm font-medium text-foreground">
                    Booking Time Window (IST)
                  </label>
                  <p class="mb-2 text-xs text-muted-foreground">
                    Only these hours will be shown as available to visitors.
                  </p>
                  <div class="flex items-center gap-3">
                    <input
                      type="time"
                      value={bookingStart()}
                      onInput={(e) => setBookingStart(e.currentTarget.value)}
                      class="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span class="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={bookingEnd()}
                      onInput={(e) => setBookingEnd(e.currentTarget.value)}
                      class="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Slot Duration */}
                <div class="mb-5">
                  <label class="mb-2 block text-sm font-medium text-foreground">
                    Slot Duration
                  </label>
                  <div class="flex gap-2">
                    <For each={DURATION_OPTIONS}>
                      {(opt) => (
                        <button
                          type="button"
                          onClick={() => setDuration(opt.value)}
                          class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            duration() === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {opt.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <Show when={statusMsg()}>
                  <div class={`mb-4 rounded-lg px-3 py-2 text-sm ${
                    statusMsg().includes("Failed") || statusMsg().includes("error")
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {statusMsg()}
                  </div>
                </Show>
              </Show>
            </div>

            <footer class="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={props.onClose}
                class="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving()}
                class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
              >
                {saving() && <Loader2 class="size-4 animate-spin" />}
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating() || saving()}
                class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {(generating() || saving()) && <Loader2 class="size-4 animate-spin" />}
                <Calendar class="size-4" />
                Save & Generate Slots
              </button>
            </footer>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default ScheduleSettingsModal;
