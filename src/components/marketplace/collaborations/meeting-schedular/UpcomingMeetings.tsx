import { CalendarDays } from "lucide-solid";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  Suspense,
} from "solid-js";
import type { MeetingFilter } from "~/types";
import MeetingDetailModal, { type MeetingData } from "./MeetingDetailModal";
import MeetingRow from "./MeetingRow";
import SectionShell from "./SectionShell";
import SegmentControl from "./SegmentControl";

async function fetchMeetings(): Promise<MeetingData[]> {
  if (typeof window === "undefined") return [];
  const res = await fetch("/api/marketplace/meetings?category=all");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.meetings) ? data.meetings : [];
}

function toMeeting(m: MeetingData) {
  const d = new Date(m.slot.date);
  const requesterName =
    m.requester?.name ||
    m.guestName ||
    m.requester?.email ||
    m.guestEmail ||
    "Guest";

  return {
    id: m.id,
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
    title: m.business?.name || requesterName,
    time: `${m.slot.startTime} - ${m.slot.endTime}`,
    location: "Online",
    locationIcon: (props: { class?: string }) => (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class={props.class}
      >
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
    category: (m.category || "partner") as "partner" | "team",
    status:
      m.status === "accepted" ? ("Confirmed" as const) : ("Pending" as const),
    participants: [requesterName.charAt(0)?.toUpperCase() ?? "?"],
    rawStatus: m.status,
    requesterName,
    rawData: m,
  };
}

function UpcomingMeetings() {
  const [filter, setFilter] = createSignal<MeetingFilter>("all");
  const [meetings, { mutate }] = createResource(fetchMeetings);
  const [selectedMeeting, setSelectedMeeting] =
    createSignal<MeetingData | null>(null);

  const filteredMeetings = createMemo(() => {
    const list = meetings.latest ?? [];
    const activeFilter = filter();
    const filtered =
      activeFilter === "all"
        ? list
        : list.filter((m) => {
            const requesterBusinessId = m.requester?.businessId;
            const category =
              m.category ||
              (requesterBusinessId && requesterBusinessId === m.business?.id
                ? "team"
                : "partner");
            return category === activeFilter;
          });
    return filtered.map(toMeeting);
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
    <>
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
          <Suspense
            fallback={
              <p class="py-8 text-center text-sm text-muted-foreground">
                Loading meetings...
              </p>
            }
          >
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
                      <MeetingRow
                        meeting={meeting}
                        delay={index() * 70}
                        onClick={() =>
                          setSelectedMeeting(meeting.rawData ?? null)
                        }
                      />
                      <Show when={meeting.rawStatus === "pending"}>
                        <div class="flex gap-2 ml-16 mb-2">
                          <button
                            type="button"
                            onClick={() => handleAccept(meeting.id)}
                            class="px-3 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
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
          </Suspense>
        </div>
      </SectionShell>
      <MeetingDetailModal
        open={selectedMeeting() !== null}
        meeting={selectedMeeting()}
        onClose={() => setSelectedMeeting(null)}
      />
    </>
  );
}

export default UpcomingMeetings;
