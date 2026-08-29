import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { CalendarDays } from "lucide-solid";
import type { Component } from "solid-js";
import type { MeetingFilter } from "~/types";
import SegmentControl from "./SegmentControl";
import MeetingRow from "./MeetingRow";
import SectionShell from "./SectionShell";

interface MeetingData {
  id: string;
  slot: { date: string; startTime: string; endTime: string };
  business: { id: string; name: string; logo: string | null; username: string | null };
  requester: { id: string; name: string | null; email: string; image: string | null };
  status: string;
  message: string | null;
  createdAt: string;
}

async function fetchMeetings(type: string): Promise<MeetingData[]> {
  if (typeof window === "undefined") return [];
  const res = await fetch(`/api/marketplace/meetings?type=${type}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.meetings) ? data.meetings : [];
}

function toMeeting(m: MeetingData) {
  const d = new Date(m.slot.date);
  return {
    id: m.id,
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
    title: m.business.name,
    time: `${m.slot.startTime} - ${m.slot.endTime}`,
    location: "Online",
    locationIcon: (props: { class?: string }) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class}>
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
    category: "partner" as const,
    status: m.status === "accepted" ? "Confirmed" as const : "Pending" as const,
    participants: [m.requester.name?.charAt(0)?.toUpperCase() ?? "?"],
    rawStatus: m.status,
    requesterName: m.requester.name || m.requester.email,
  };
}

function UpcomingMeetings() {
  const [filter, setFilter] = createSignal<MeetingFilter>("all");
  const [meetings, { mutate }] = createResource(filter, fetchMeetings);

  const filteredMeetings = createMemo(() => {
    const list = meetings() ?? [];
    return list.map(toMeeting);
  });

  const handleAccept = async (id: string) => {
    if (typeof window === "undefined") return;
    const res = await fetch(`/api/marketplace/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      mutate((prev) =>
        (prev ?? []).map((m) =>
          m.id === id ? { ...m, status: "accepted" } : m,
        ),
      );
    }
  };

  const handleReject = async (id: string) => {
    if (typeof window === "undefined") return;
    const res = await fetch(`/api/marketplace/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      mutate((prev) =>
        (prev ?? []).map((m) =>
          m.id === id ? { ...m, status: "rejected" } : m,
        ),
      );
    }
  };

  return (
    <SectionShell>
      <header class="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
        <h3 class="flex items-center gap-2">
          <CalendarDays class="size-5 text-primary" />
          Upcoming Meetings
        </h3>
        <div class="flex items-center gap-3 overflow-x-auto pb-1 xl:pb-0">
          <SegmentControl
            compact
            value={filter()}
            onChange={setFilter}
            options={[
              { label: "All Meetings", value: "all" },
              { label: "External Partners", value: "partner" },
              { label: "Internal Team", value: "team" },
            ]}
          />
        </div>
      </header>
      <div class="flex min-h-40 flex-col gap-1 p-3 sm:p-5">
        <Show
          when={!meetings.loading}
          fallback={
            <p class="py-8 text-center text-sm text-muted-foreground">
              Loading meetings...
            </p>
          }
        >
          <Show
            when={filteredMeetings().length > 0}
            fallback={
              <p class="py-8 text-center text-sm text-muted-foreground">
                No meetings found.
              </p>
            }
          >
            <For each={filteredMeetings()}>
              {(meeting, index) => (
                <div>
                  <MeetingRow meeting={meeting} delay={index() * 70} />
                  <Show when={meeting.rawStatus === "pending"}>
                    <div class="flex gap-2 ml-16 mb-2">
                      <button
                        onClick={() => handleAccept(meeting.id)}
                        class="px-3 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(meeting.id)}
                        class="px-3 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </SectionShell>
  );
}

export default UpcomingMeetings;
