import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CalendarDays,
  CheckCircle2,
  LayoutList,
  Users,
  XCircle,
} from "lucide-solid";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { EmptyState } from "~/components/ui/empty-state";
import { SkeletonRows, WidgetError } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import type { MeetingFilter } from "~/types";
import FilterChip from "./FilterChip";
import MeetingDetailModal, { type MeetingData } from "./MeetingDetailModal";
import MeetingRow from "./MeetingRow";
import { counterpartyName, statusDisplay } from "./meeting-display";
import SectionShell from "./SectionShell";

type DirectionFilter = "all" | "incoming" | "outgoing";

async function fetchMeetings(
  direction: DirectionFilter,
): Promise<MeetingData[]> {
  if (typeof window === "undefined") return [];
  const res = await fetch(
    `/api/marketplace/meetings?type=${direction}&category=all`,
  );
  if (!res.ok) {
    throw new Error(`Couldn't load meetings (${res.status})`);
  }
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
  const direction = m.direction ?? "outgoing";

  return {
    id: m.id,
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
    title: counterpartyName({ ...m, direction }),
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
    status: statusDisplay(m.status).label,
    participants: [requesterName.charAt(0)?.toUpperCase() ?? "?"],
    rawStatus: m.status,
    direction,
    requesterName,
    rawData: m,
  };
}

function UpcomingMeetings() {
  const [filter, setFilter] = createSignal<MeetingFilter>("all");
  const [direction, setDirection] = createSignal<DirectionFilter>("all");
  const [meetings, { refetch }] = createResource(direction, fetchMeetings);
  const [selectedMeeting, setSelectedMeeting] =
    createSignal<MeetingData | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [pendingId, setPendingId] = createSignal<string | null>(null);

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

  const handleDecision = async (id: string, action: "accept" | "reject") => {
    if (typeof window === "undefined") return;
    setActionError(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/marketplace/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(
          (data as { error?: string }).error ?? "Failed to update the meeting.",
        );
        notify("error", "Couldn't update the meeting");
        return;
      }
      notify(
        "success",
        action === "accept" ? "Meeting accepted" : "Meeting declined",
      );
      refetch();
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <SectionShell>
        <header class="flex flex-col gap-4 border-b border-border p-5">
          <div class="flex items-center gap-2.5">
            <span class="grid size-10 shrink-0 place-items-center rounded-card bg-primary/10 text-primary">
              <CalendarDays class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 class="font-heading text-lg font-semibold text-foreground">
                Upcoming Meetings
              </h2>
              <p class="tnum text-xs text-muted-foreground">
                {filteredMeetings().length} scheduled
              </p>
            </div>
          </div>
          <div
            class="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter meetings by direction"
          >
            <FilterChip
              label="All"
              icon={LayoutList}
              pressed={direction() === "all"}
              onClick={() => setDirection("all")}
            />
            <FilterChip
              label="Incoming"
              icon={ArrowDownToLine}
              pressed={direction() === "incoming"}
              onClick={() => setDirection("incoming")}
            />
            <FilterChip
              label="Outgoing"
              icon={ArrowUpFromLine}
              pressed={direction() === "outgoing"}
              onClick={() => setDirection("outgoing")}
            />
          </div>
          <div
            class="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter meetings by type"
          >
            <FilterChip
              label="All Meetings"
              icon={LayoutList}
              pressed={filter() === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterChip
              label="External Partners"
              icon={Building2}
              pressed={filter() === "partner"}
              onClick={() => setFilter("partner")}
            />
            <FilterChip
              label="Internal Team"
              icon={Users}
              pressed={filter() === "team"}
              onClick={() => setFilter("team")}
            />
          </div>
        </header>
        <div class="flex min-h-40 flex-col gap-1 p-3 sm:p-5" aria-live="polite">
          <Show when={actionError()}>
            <WidgetError
              message={actionError()!}
              retryLabel="Dismiss"
              onRetry={() => setActionError(null)}
            />
          </Show>
          <Show when={meetings.error}>
            <WidgetError
              message="Couldn't load meetings. Your cached list is unaffected."
              onRetry={() => refetch()}
              retryLabel="Retry"
            />
          </Show>
          <Show when={meetings.loading && filteredMeetings().length === 0}>
            <SkeletonRows count={3} />
          </Show>
          <Show when={!meetings.loading && !meetings.error}>
            <Show
              when={filteredMeetings().length > 0}
              fallback={
                <EmptyState
                  icon={CalendarDays}
                  title="No meetings found"
                  description={
                    direction() === "incoming"
                      ? "No incoming requests. New partner requests will appear here."
                      : direction() === "outgoing"
                        ? "No outgoing requests. Book a slot with a partner to get started."
                        : "No meetings yet. Book a slot with a partner to get started."
                  }
                  primaryLabel="Browse partners"
                  primaryHref="/marketplace"
                />
              }
            >
              <ul class="grid gap-1">
                <For each={filteredMeetings()}>
                  {(meeting, index) => (
                    <li>
                      <MeetingRow
                        meeting={meeting}
                        delay={index() * 60}
                        onClick={() =>
                          setSelectedMeeting(meeting.rawData ?? null)
                        }
                      />
                      <Show
                        when={
                          meeting.rawStatus === "pending" &&
                          meeting.direction === "incoming"
                        }
                      >
                        <div class="flex flex-wrap gap-2 py-2 pl-16 sm:pl-16">
                          <button
                            type="button"
                            disabled={pendingId() === meeting.id}
                            onClick={() => handleDecision(meeting.id, "accept")}
                            class="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-success/25 bg-success-muted px-4 py-2 text-sm font-medium text-success transition-opacity duration-150 motion-reduce:transition-none hover:opacity-80 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <CheckCircle2 class="size-4" aria-hidden="true" />
                            {pendingId() === meeting.id
                              ? "Accepting…"
                              : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={pendingId() === meeting.id}
                            onClick={() => handleDecision(meeting.id, "reject")}
                            class="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-destructive/25 bg-destructive-muted px-4 py-2 text-sm font-medium text-destructive transition-opacity duration-150 motion-reduce:transition-none hover:opacity-80 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <XCircle class="size-4" aria-hidden="true" />
                            {pendingId() === meeting.id
                              ? "Declining…"
                              : "Decline"}
                          </button>
                        </div>
                      </Show>
                      <Show
                        when={
                          meeting.rawStatus === "pending" &&
                          meeting.direction === "outgoing"
                        }
                      >
                        <p class="px-16 py-1 text-xs text-muted-foreground">
                          Awaiting response
                        </p>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
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
