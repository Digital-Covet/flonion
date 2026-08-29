import { For, Show, createResource, createSignal, createMemo } from "solid-js";
import Calendar from "lucide-solid/icons/calendar";
import { useNavigate } from "@solidjs/router";
import { GlassCard } from "./glass-card";
import { Button } from "./button";
import { SectionHeading } from "./section-heading";
import { DayChip } from "./day-chip";
import { TimeSlot } from "./time-slot";

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

interface SchedulerProps {
  businessId: string;
}

async function fetchSlots(businessId: string): Promise<Slot[]> {
  const res = await fetch(
    `/api/marketplace/slots?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.slots) ? data.slots : [];
}

function formatDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export const Scheduler = (props: SchedulerProps) => {
  const navigate = useNavigate();
  const [slots, { mutate }] = createResource(
    () => props.businessId,
    fetchSlots,
  );

  const [activeDay, setActiveDay] = createSignal(0);
  const [activeTime, setActiveTime] = createSignal<string | null>(null);
  const [booking, setBooking] = createSignal(false);
  const [booked, setBooked] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const groupedByDay = createMemo(() => {
    const allSlots = slots() ?? [];
    const groups = new Map<string, Slot[]>();
    for (const slot of allSlots) {
      const key = formatDateKey(slot.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(slot);
    }
    return Array.from(groups.entries());
  });

  const dayKeys = createMemo(() => groupedByDay().map(([key]) => key));

  const currentDaySlots = createMemo(() => {
    const idx = activeDay();
    const group = groupedByDay()[idx];
    return group ? group[1] : [];
  });

  const handleConfirm = async () => {
    const slotId = activeTime();
    if (!slotId) return;

    setBooking(true);
    setError(null);

    try {
      const res = await fetch("/api/marketplace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          businessId: props.businessId,
        }),
      });

      if (res.status === 401) {
        navigate(`/login?callbackURL=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to book meeting");
        return;
      }

      setBooked(true);
      mutate((prev) =>
        (prev ?? []).map((s) =>
          s.id === slotId ? { ...s, isBooked: true } : s,
        ),
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <GlassCard>
      <div class="flex items-center gap-2 mb-5">
        <span class="text-primary">
          <Calendar size={22} />
        </span>
        <SectionHeading>Book a Discovery Call</SectionHeading>
      </div>
      <p class="text-sm text-muted-foreground mb-4">
        Select an available time slot to discuss your project needs.
      </p>

      <Show
        when={!slots.loading}
        fallback={
          <p class="text-sm text-muted-foreground py-4">
            Loading available slots...
          </p>
        }
      >
        <Show
          when={groupedByDay().length > 0}
          fallback={
            <p class="text-sm text-muted-foreground py-4">
              No available time slots. Check back later.
            </p>
          }
        >
          <div class="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
            <For each={groupedByDay()}>
              {(_, i) => (
                <DayChip
                  label={formatDayLabel(groupedByDay()![i()][1][0].date)}
                  active={activeDay() === i()}
                  onClick={() => {
                    setActiveDay(i());
                    setActiveTime(null);
                  }}
                />
              )}
            </For>
          </div>

          <div class="grid grid-cols-2 gap-2 mb-4">
            <For each={currentDaySlots()}>
              {(slot) => (
                <TimeSlot
                  time={`${slot.startTime} - ${slot.endTime}`}
                  state={
                    activeTime() === slot.id
                      ? "selected"
                      : slot.isBooked
                        ? "disabled"
                        : "available"
                  }
                  onClick={() => {
                    if (!slot.isBooked) setActiveTime(slot.id);
                  }}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={booked()}>
        <div class="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          Meeting request sent! The owner will be notified.
        </div>
      </Show>

      <Show when={error()}>
        <div class="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error()}
        </div>
      </Show>

      <Button
        variant="dark"
        onClick={handleConfirm}
        disabled={!activeTime() || booking() || booked()}
      >
        {booking() ? "Booking..." : booked() ? "Request Sent" : "Confirm Time"}
      </Button>
    </GlassCard>
  );
};
