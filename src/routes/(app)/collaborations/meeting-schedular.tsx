import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import {
  IconCalendarEvent,
  IconCalendarPlus,
  IconMoodSearch,
} from "@tabler/icons-solidjs";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { isLoading, settled } from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import {
  tabListClass,
  tabTriggerClass,
} from "~/components/marketplace/portfolio";
import {
  addDays,
  CATEGORY_OPTIONS,
  type CategoryFilter,
  dayKey,
  decideMeeting,
  generateSlots,
  loadLoadSummary,
  loadMeetings,
  loadMySlots,
  loadScheduleSettings,
  MAX_GENERATE_DAYS,
  MEETING_TABS,
  type Meeting,
  type MeetingsView,
  type MeetingTab,
  matchesView,
  matchingDayCount,
  needsReplyCount,
  parseWorkingDays,
  requestCountLabel,
  STATUS_OPTIONS,
  type StatusFilter,
  slotsPerDay,
  sortDays,
  sortForTriage,
  startOfWeek,
  viewFrom,
  viewParams,
  weekStart,
} from "~/components/meetings/data";
import {
  AvailabilityDialog,
  CalendarSkeleton,
  DecisionDialog,
  LoadCard,
  LoadSkeleton,
  RequestCard,
  RequestsSkeleton,
  SectionHeading,
  TabCount,
  WeekCalendar,
  WeekNav,
  WeekSummary,
} from "~/components/meetings/widgets";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  SelectField,
} from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";
import { tzLabel } from "~/lib/timezone-label";

/**
 * Meeting scheduler (spec §6, `/collaborations/meeting-schedular`).
 *
 * Three regions, in the order the owner works through them: how full the week
 * is, the week itself, and the requests waiting on a reply. Each region loads
 * and fails on its own, so one slow endpoint never blanks the page
 * (spec §4.5).
 */
export default function MeetingSchedulerPage() {
  const [params, setParams] = useSearchParams();
  const view = createMemo(() => viewFrom(params));

  // API routes need the browser's cookies, so nothing fetches during SSR.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [meetings, { refetch: refetchMeetings }] = createResource(
    ready,
    loadMeetings,
  );
  const [slots, { refetch: refetchSlots }] = createResource(ready, loadMySlots);
  const [load, { refetch: refetchLoad }] = createResource(
    ready,
    loadLoadSummary,
  );
  const [settings] = createResource(ready, loadScheduleSettings);

  const [message, setMessage] = createSignal("");
  /** Copy failures: shown once at the top, where the page's other news is. */
  const [actionError, setActionError] = createSignal("");
  /** Decision failures stay inside the dialog that caused them. */
  const [decisionError, setDecisionError] = createSignal("");

  /** The request the confirm dialog is about, with the action it will apply. */
  const [decision, setDecision] = createSignal<{
    meeting: Meeting;
    action: "accept" | "reject";
  } | null>(null);
  const [deciding, setDeciding] = createSignal(false);
  /** Ids mid-flight, so a card can grey out without freezing the rest. */
  const [working, setWorking] = createSignal<ReadonlySet<string>>(new Set());

  const [slotsOpen, setSlotsOpen] = createSignal(false);
  const [range, setRange] = createSignal({ start: "", end: "" });
  /** Weekdays the next run will open; starts from the saved working days. */
  const [days, setDays] = createSignal<number[]>([]);
  const [opening, setOpening] = createSignal(false);
  const [rangeError, setRangeError] = createSignal("");

  const now = new Date();
  const allMeetings = () => settled(meetings) ?? [];
  const allSlots = () => settled(slots) ?? [];
  const start = () => weekStart(view(), now);
  const isCurrentWeek = () => dayKey(start()) === dayKey(startOfWeek(now));
  const config = () => settled(settings) ?? undefined;
  const tz = () => tzLabel(config()?.timezone);

  const forTab = (tab: MeetingTab) =>
    sortForTriage(
      allMeetings().filter((m) => matchesView(m, { ...view(), tab })),
    );
  /** Tab counts ignore the status and category filters, so nothing hides. */
  const countFor = (tab: MeetingTab) =>
    allMeetings().filter((m) =>
      matchesView(m, { ...view(), tab, status: "all", category: "all" }),
    ).length;

  const filtersActive = () =>
    view().status !== "all" || view().category !== "all";

  // Re-announce even when the text repeats, so the live region always fires.
  function announce(text: string) {
    setMessage("");
    queueMicrotask(() => setMessage(text));
  }

  // One announcement per settled load: what still needs the owner's reply.
  createEffect(
    on(
      () => settled(meetings),
      (list) => {
        if (!list) return;
        const waiting = needsReplyCount(list);
        announce(
          waiting === 0
            ? "No meeting requests are waiting for your reply"
            : `${waiting} meeting ${requestCountLabel(waiting)} waiting for your reply`,
        );
      },
      { defer: true },
    ),
  );

  // Requests arrive by email while the owner is away, so a refocus refetches.
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refetchMeetings();
      refetchSlots();
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", onVisible),
    );
  });

  function update(next: Partial<MeetingsView>) {
    setParams(viewParams({ ...view(), ...next }, now), { replace: true });
  }

  function showWeek(next: Date) {
    update({ week: dayKey(startOfWeek(next)) });
  }

  function clearFilters() {
    update({ status: "all", category: "all" });
    announce("Filters cleared");
  }

  /** Accept and reject both confirm first: neither can be undone from here. */
  async function confirmDecision() {
    const pending = decision();
    if (!pending) return;
    const { meeting, action } = pending;

    setDeciding(true);
    setDecisionError("");
    setWorking((ids) => new Set(ids).add(meeting.id));

    try {
      await decideMeeting(meeting.id, action);
      setDecision(null);
      announce(
        action === "accept"
          ? `Meeting with ${meeting.requester?.name ?? "the requester"} accepted`
          : "Meeting request declined and the slot freed",
      );
      // The slot and the week's load both change with the decision.
      refetchMeetings();
      refetchSlots();
      refetchLoad();
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "We couldn't save that decision. Try again.",
      );
    } finally {
      setDeciding(false);
      setWorking((ids) => {
        const next = new Set(ids);
        next.delete(meeting.id);
        return next;
      });
    }
  }

  /** Saved working days, or Mon–Fri until the settings arrive. */
  const workingDays = () => {
    const saved = config()?.workingDays;
    const parsed = saved ? parseWorkingDays(saved) : [];
    return parsed.length > 0 ? parsed : [1, 2, 3, 4, 5];
  };

  function openSlotsDialog() {
    const from = isCurrentWeek() ? now : start();
    setRange({
      start: dayKey(from),
      end: dayKey(addDays(start(), 6)),
    });
    setDays(workingDays());
    setRangeError("");
    setSlotsOpen(true);
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : sortDays([...current, day]),
    );
    setRangeError("");
  }

  async function submitRange() {
    const { start: from, end: to } = range();
    if (!from || !to) {
      setRangeError("Choose both dates.");
      return;
    }
    if (to <= from) {
      setRangeError("The end date has to be after the start date.");
      return;
    }
    if (days().length === 0) {
      setRangeError("Pick at least one day of the week to open.");
      return;
    }
    if (matchingDayCount(from, to, days()) === 0) {
      setRangeError(
        "None of the days you picked fall inside these dates. Widen the range or pick another day.",
      );
      return;
    }

    setOpening(true);
    setRangeError("");
    try {
      const created = await generateSlots(from, to, days());
      setSlotsOpen(false);
      announce(
        created === 0
          ? "No slots were created — check your booking hours in Settings"
          : `${created} slots opened for booking`,
      );
      refetchSlots();
      refetchLoad();
    } catch (error) {
      setRangeError(
        error instanceof Error
          ? error.message
          : `We couldn't open those slots. Ranges can cover up to ${MAX_GENERATE_DAYS} days.`,
      );
    } finally {
      setOpening(false);
    }
  }

  /**
   * A component rather than a shared element: the same button appears in the
   * header and in two empty states, and one DOM node can only live in one of
   * them.
   */
  const OpenSlotsButton = () => (
    <button type="button" onClick={openSlotsDialog} class={btnPrimary}>
      <IconCalendarPlus aria-hidden="true" class="size-5" />
      Open slots
    </button>
  );

  return (
    <>
      <Title>Meetings · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-8">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Meetings
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              Reply to meeting requests, and keep enough slots open for partners
              and your team to book. All times are shown in {tz()}.
            </p>
          </div>
          <div class="shrink-0">
            <OpenSlotsButton />
          </div>
        </header>

        <Show when={actionError()}>
          {(error) => <Notice tone="error">{error()}</Notice>}
        </Show>

        {/* ── Load ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="load-heading" class="flex flex-col gap-4">
          <SectionHeading
            id="load-heading"
            title="Your load"
            lead="How much of the time you have opened is already taken."
          />
          <Switch>
            <Match when={isLoading(load)}>
              <LoadSkeleton />
            </Match>
            <Match when={load.state === "errored"}>
              <WidgetError what="your schedule load" onRetry={refetchLoad} />
            </Match>
            <Match when={settled(load)}>
              {(summary) => (
                <>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <LoadCard title="This week" bucket={summary().thisWeek} />
                    <LoadCard title="Next week" bucket={summary().nextWeek} />
                  </div>
                  <Show when={summary().tip}>
                    {(tip) => <Notice tone="info">{tip()}</Notice>}
                  </Show>
                </>
              )}
            </Match>
          </Switch>
        </section>

        {/* ── Week calendar ────────────────────────────────────────────── */}
        <section aria-labelledby="calendar-heading" class="flex flex-col gap-4">
          <SectionHeading
            id="calendar-heading"
            title="Week"
            lead={`Booked slots name who they are with. Times are in ${tz()}.`}
          />

          <div class="flex flex-wrap items-center justify-between gap-3">
            <WeekNav
              start={start()}
              isCurrentWeek={isCurrentWeek()}
              onChange={showWeek}
              onToday={() => update({ week: dayKey(startOfWeek(now)) })}
            />
            {/* Hidden while the account has no slots at all: the empty
                state below already says so, in more useful words. */}
            <Show when={slots.state === "ready" && allSlots().length > 0}>
              <WeekSummary slots={allSlots()} start={start()} />
            </Show>
          </div>

          <Switch>
            <Match when={isLoading(slots)}>
              <CalendarSkeleton />
            </Match>
            <Match when={slots.state === "errored"}>
              <WidgetError what="your calendar" onRetry={refetchSlots} />
            </Match>
            <Match when={allSlots().length === 0}>
              <div class="rounded-lg border border-border bg-surface">
                <EmptyState
                  icon={IconCalendarPlus}
                  title="No slots are open yet"
                  action={<OpenSlotsButton />}
                >
                  Partners can only request a meeting in a slot you have opened.
                  Slots are built from the working hours in your settings.
                </EmptyState>
              </div>
            </Match>
            <Match when={true}>
              <WeekCalendar
                start={start()}
                slots={allSlots()}
                meetings={allMeetings()}
                today={now}
              />
            </Match>
          </Switch>
        </section>

        {/* ── Requests ─────────────────────────────────────────────────── */}
        <section aria-labelledby="requests-heading" class="flex flex-col gap-4">
          <SectionHeading
            id="requests-heading"
            title="Requests"
            lead="Incoming requests wait on your reply; outgoing ones wait on theirs."
          />

          <Tabs.Root
            value={view().tab}
            onValueChange={(e) => update({ tab: e.value as MeetingTab })}
            class="flex flex-col gap-4"
          >
            <Tabs.List class={tabListClass}>
              <For each={MEETING_TABS}>
                {(tab) => (
                  <Tabs.Trigger value={tab.value} class={tabTriggerClass}>
                    {tab.label}
                    <TabCount value={countFor(tab.value)} />
                  </Tabs.Trigger>
                )}
              </For>
            </Tabs.List>

            <div class="flex flex-wrap items-end gap-3">
              <SelectField
                label="Status"
                options={STATUS_OPTIONS}
                value={view().status}
                onChange={(status) =>
                  update({ status: status as StatusFilter })
                }
                class="w-full sm:w-52"
              />
              <SelectField
                label="With"
                options={CATEGORY_OPTIONS}
                value={view().category}
                onChange={(category) =>
                  update({ category: category as CategoryFilter })
                }
                class="w-full sm:w-44"
              />
              <Show when={filtersActive()}>
                <button
                  type="button"
                  onClick={clearFilters}
                  class={cn(btnSecondary, "min-h-11 px-4 text-sm")}
                >
                  Clear filters
                </button>
              </Show>
            </div>

            <For each={MEETING_TABS}>
              {(tab) => {
                /** Each panel filters for its own direction, not the open tab. */
                const rows = () => forTab(tab.value);
                return (
                  <Tabs.Content value={tab.value} class="outline-none">
                    <Switch>
                      <Match when={isLoading(meetings)}>
                        <RequestsSkeleton />
                      </Match>

                      <Match when={meetings.state === "errored"}>
                        <WidgetError
                          what="your meeting requests"
                          onRetry={refetchMeetings}
                        />
                      </Match>

                      <Match when={rows().length > 0}>
                        <ul
                          aria-busy={meetings.state === "refreshing"}
                          class="flex flex-col gap-3"
                        >
                          <For each={rows()}>
                            {(meeting) => (
                              <RequestCard
                                meeting={meeting}
                                pending={working().has(meeting.id)}
                                onDecide={(m, action) =>
                                  setDecision({ meeting: m, action })
                                }
                                announce={announce}
                                onCopyFailed={() =>
                                  setActionError(
                                    "We couldn't copy the link. Copy it from the Join button instead.",
                                  )
                                }
                              />
                            )}
                          </For>
                        </ul>
                      </Match>

                      <Match when={filtersActive()}>
                        <EmptyState
                          icon={IconMoodSearch}
                          title="No requests match these filters"
                          action={
                            <button
                              type="button"
                              onClick={clearFilters}
                              class="min-h-11 font-medium text-primary underline underline-offset-4"
                            >
                              Clear filters
                            </button>
                          }
                        >
                          Try another status, or look at requests with everyone
                          rather than one group.
                        </EmptyState>
                      </Match>

                      <Match when={tab.value === "outgoing"}>
                        <EmptyState
                          icon={IconCalendarEvent}
                          title="You haven't requested a meeting yet"
                          action={
                            <A
                              href="/marketplace"
                              class="min-h-11 font-medium text-primary underline underline-offset-4"
                            >
                              Find a partner
                            </A>
                          }
                        >
                          Open a partner's profile in the marketplace and pick
                          one of their open slots.
                        </EmptyState>
                      </Match>

                      <Match when={true}>
                        <EmptyState
                          icon={IconCalendarEvent}
                          title="No meeting requests yet"
                          action={<OpenSlotsButton />}
                        >
                          Partners who find you in the marketplace can book the
                          slots you open here, and your team's requests land in
                          the same list.
                        </EmptyState>
                      </Match>
                    </Switch>
                  </Tabs.Content>
                );
              }}
            </For>
          </Tabs.Root>
        </section>
      </div>

      <DecisionDialog
        decision={decision()}
        pending={deciding()}
        error={decisionError()}
        onConfirm={confirmDecision}
        onClose={() => {
          setDecision(null);
          setDecisionError("");
        }}
      />

      <AvailabilityDialog
        open={slotsOpen()}
        start={range().start}
        end={range().end}
        pending={opening()}
        error={rangeError()}
        days={days()}
        workingDays={workingDays()}
        slotsPerDay={config() ? slotsPerDay(config()!) : 0}
        slotDuration={config()?.slotDuration}
        bookingWindow={
          config()
            ? `${config()!.bookingStartTime}–${config()!.bookingEndTime}`
            : undefined
        }
        onChange={(next) => setRange((r) => ({ ...r, ...next }))}
        onToggleDay={toggleDay}
        onSubmit={submitRange}
        onClose={() => setSlotsOpen(false)}
      />
    </>
  );
}
