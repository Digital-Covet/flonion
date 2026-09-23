import { Dialog } from "@ark-ui/solid/dialog";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBan,
  IconBuildingStore,
  IconCalendarOff,
  IconCalendarPlus,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconUsers,
  IconVideo,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { focusRing, inputBase, labelClass } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import {
  addDays,
  canDecide,
  counterparty,
  counterpartyEmail,
  dayKey,
  dayLabel,
  isSameDay,
  type LoadBucket,
  MAX_GENERATE_DAYS,
  type Meeting,
  type MeetingCategory,
  type MeetingStatus,
  matchingDayCount,
  meetingsOnDay,
  meetingWhen,
  type Slot,
  STATUS_LABEL,
  slotCountLabel,
  slotsOnDay,
  WEEKDAYS,
  weekDays,
  weekRangeLabel,
} from "~/components/meetings/data";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  Spinner,
} from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";

/**
 * Meeting scheduler widgets (spec §6: week calendar with a list view below
 * `md`, incoming/outgoing requests, team/partner chips, Meet link copy).
 *
 * Every status and category reads as an icon plus a word — never colour alone
 * (spec §1 anti-pattern 4).
 */

export const cardClass =
  "rounded-lg border border-border bg-surface p-4 md:p-5";

const chipClass =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

// ─── Status & category chips ─────────────────────────────────────────────

const STATUS_ICON: Record<MeetingStatus, typeof IconClock> = {
  pending: IconClock,
  accepted: IconCircleCheck,
  rejected: IconCircleX,
  cancelled: IconBan,
};

const STATUS_TONE: Record<MeetingStatus, string> = {
  pending: "bg-primary-soft text-primary",
  accepted: "bg-success/10 text-success",
  rejected: "bg-error/10 text-error",
  cancelled: "bg-primary-soft text-text-muted",
};

/** Chips are icon + word, so a colour is never the only signal. */
function ChipIcon(props: { icon: typeof IconClock }) {
  return <props.icon aria-hidden="true" class="size-3.5 shrink-0" />;
}

export function StatusChip(props: { status: MeetingStatus }) {
  return (
    <span class={cn(chipClass, STATUS_TONE[props.status])}>
      <ChipIcon icon={STATUS_ICON[props.status]} />
      {STATUS_LABEL[props.status]}
    </span>
  );
}

export function CategoryChip(props: { category: MeetingCategory }) {
  return (
    <span class={cn(chipClass, "bg-background text-text-muted")}>
      <ChipIcon
        icon={props.category === "team" ? IconUsers : IconBuildingStore}
      />
      {props.category === "team" ? "Team" : "Partner"}
    </span>
  );
}

export function DirectionChip(props: { direction: "incoming" | "outgoing" }) {
  return (
    <span class={cn(chipClass, "bg-background text-text-muted")}>
      <ChipIcon
        icon={
          props.direction === "incoming" ? IconArrowDownLeft : IconArrowUpRight
        }
      />
      {props.direction === "incoming" ? "They asked you" : "You asked them"}
    </span>
  );
}

// ─── Load ────────────────────────────────────────────────────────────────

/**
 * How full a week is. The percentage carries the meaning; the bar only
 * repeats it, and the wording ("High", "Open") comes from the API.
 */
export function LoadCard(props: { title: string; bucket: LoadBucket }) {
  const value = () => Math.min(100, Math.max(0, props.bucket.value));
  return (
    <div class={cn(cardClass, "gap-2")}>
      <p class="text-sm font-medium text-text-muted">{props.title}</p>
      <p class="mt-1 flex items-baseline gap-2">
        <span class="font-mono text-xl font-medium tabular-nums text-text">
          {value()}%
        </span>
        <span class="text-sm text-text-muted">booked</span>
      </p>
      <div
        aria-hidden="true"
        class="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-soft"
      >
        <div
          class={cn(
            "h-full origin-left rounded-full transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none",
            props.bucket.tone === "orange" ? "bg-accent" : "bg-primary",
          )}
          style={{ transform: `scaleX(${value() / 100})` }}
        />
      </div>
      <p class="mt-2 text-sm text-text-muted">{props.bucket.detail}</p>
    </div>
  );
}

export function LoadSkeleton() {
  return (
    <div aria-busy="true" class="grid gap-4 sm:grid-cols-2">
      <span class="sr-only">Loading your schedule load…</span>
      <For each={[0, 1]}>
        {() => (
          <div class={cardClass}>
            <Skeleton class="h-4 w-24" />
            <Skeleton class="mt-3 h-6 w-20" />
            <Skeleton class="mt-3 h-1.5 w-full" />
            <Skeleton class="mt-3 h-4 w-28 opacity-70" />
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Week calendar ───────────────────────────────────────────────────────

export function WeekNav(props: {
  start: Date;
  onChange: (start: Date) => void;
  onToday: () => void;
  isCurrentWeek: boolean;
}) {
  const navButton = cn(
    "grid size-11 place-items-center rounded-md border border-border-strong text-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-primary-soft hover:text-text",
    focusRing,
  );
  return (
    <div class="flex items-center gap-2">
      <button
        type="button"
        class={navButton}
        aria-label="Previous week"
        onClick={() => props.onChange(addDays(props.start, -7))}
      >
        <IconChevronLeft aria-hidden="true" class="size-5" />
      </button>
      <button
        type="button"
        class={navButton}
        aria-label="Next week"
        onClick={() => props.onChange(addDays(props.start, 7))}
      >
        <IconChevronRight aria-hidden="true" class="size-5" />
      </button>
      <button
        type="button"
        onClick={() => props.onToday()}
        disabled={props.isCurrentWeek}
        class={cn(
          btnSecondary,
          "min-h-11 px-3 text-sm disabled:cursor-default disabled:opacity-50",
        )}
      >
        This week
      </button>
      <p class="ml-1 min-w-0 truncate font-mono text-sm tabular-nums text-text-muted">
        {weekRangeLabel(props.start)}
      </p>
    </div>
  );
}

type DayData = {
  date: Date;
  key: string;
  slots: Slot[];
  meetings: Meeting[];
  isToday: boolean;
};

function buildWeek(
  start: Date,
  slots: Slot[],
  meetings: Meeting[],
  today: Date,
): DayData[] {
  return weekDays(start).map((date) => {
    const key = dayKey(date);
    return {
      date,
      key,
      slots: slotsOnDay(slots, key),
      meetings: meetingsOnDay(meetings, key),
      isToday: isSameDay(date, today),
    };
  });
}

/** One booked or free slot. Booked slots name who they are with. */
function SlotRow(props: { slot: Slot; meeting?: Meeting }) {
  const booked = () => props.slot.isBooked;
  return (
    <li
      class={cn(
        "flex min-h-11 flex-col justify-center gap-0.5 rounded-sm px-2 py-1.5 text-left",
        booked()
          ? "bg-primary-soft text-primary"
          : "border border-dashed border-border-strong text-text-muted",
      )}
    >
      <span class="font-mono text-xs font-medium tabular-nums">
        {props.slot.startTime}–{props.slot.endTime}
      </span>
      <span class="truncate text-xs">
        <Show when={booked()} fallback="Free">
          <Show when={props.meeting} fallback="Booked">
            {(m) => (
              <>
                {counterparty(m())}
                <span class="sr-only">
                  {" "}
                  · {STATUS_LABEL[m().status].toLowerCase()}
                </span>
              </>
            )}
          </Show>
        </Show>
      </span>
    </li>
  );
}

function DayColumn(props: { day: DayData }) {
  /** Declined and cancelled requests are already out of `day.meetings`. */
  const meetingFor = (slot: Slot) =>
    props.day.meetings.find((m) => m.slot.startTime === slot.startTime);

  return (
    <div class="flex min-w-0 flex-col rounded-md border border-border bg-background/40 p-2">
      <p
        class={cn(
          "mb-2 flex items-baseline justify-between gap-1 px-1",
          props.day.isToday ? "text-primary" : "text-text-muted",
        )}
      >
        {/* The short label is for scanning; the full date is for listening. */}
        <span class="sr-only">
          {dayLabel(props.day.date)}
          {props.day.isToday ? " (today)" : ""}
        </span>
        <span aria-hidden="true" class="text-xs font-medium uppercase">
          {props.day.date.toLocaleDateString(undefined, { weekday: "short" })}
        </span>
        <span
          aria-hidden="true"
          class="font-mono text-sm font-medium tabular-nums"
        >
          {props.day.date.getDate()}
        </span>
      </p>
      <Show
        when={props.day.slots.length > 0}
        fallback={<p class="px-1 pb-1 text-xs text-text-muted">No slots</p>}
      >
        <ul class="flex flex-col gap-1">
          <For each={props.day.slots}>
            {(slot) => <SlotRow slot={slot} meeting={meetingFor(slot)} />}
          </For>
        </ul>
      </Show>
    </div>
  );
}

/**
 * Seven columns on `md`+; below that the same days stack as a list, because a
 * horizontally scrolling week hides the day the owner is looking for (spec §1
 * anti-pattern 5).
 */
export function WeekCalendar(props: {
  start: Date;
  slots: Slot[];
  meetings: Meeting[];
  today: Date;
}) {
  const days = () =>
    buildWeek(props.start, props.slots, props.meetings, props.today);
  const withSlots = () => days().filter((d) => d.slots.length > 0);

  return (
    <>
      <div class="hidden grid-cols-7 gap-2 md:grid">
        <For each={days()}>{(day) => <DayColumn day={day} />}</For>
      </div>

      <div class="flex flex-col gap-3 md:hidden">
        <Show
          when={withSlots().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              No slots are open in this week.
            </p>
          }
        >
          <For each={withSlots()}>
            {(day) => (
              <div>
                <p
                  class={cn(
                    "mb-1.5 text-sm font-medium",
                    day.isToday ? "text-primary" : "text-text",
                  )}
                >
                  {dayLabel(day.date)}
                  <Show when={day.isToday}>
                    <span class="ml-1 text-xs font-normal">(today)</span>
                  </Show>
                </p>
                <ul class="flex flex-col gap-1">
                  <For each={day.slots}>
                    {(slot) => (
                      <SlotRow
                        slot={slot}
                        meeting={day.meetings.find(
                          (m) => m.slot.startTime === slot.startTime,
                        )}
                      />
                    )}
                  </For>
                </ul>
              </div>
            )}
          </For>
        </Show>
      </div>
    </>
  );
}

export function CalendarSkeleton() {
  return (
    <div aria-busy="true">
      <span class="sr-only">Loading your week…</span>
      <div class="hidden grid-cols-7 gap-2 md:grid">
        <For each={Array.from({ length: 7 })}>
          {() => (
            <div class="rounded-md border border-border p-2">
              <Skeleton class="h-4 w-full" />
              <Skeleton class="mt-2 h-10 w-full" />
              <Skeleton class="mt-1 h-10 w-full opacity-70" />
            </div>
          )}
        </For>
      </div>
      <div class="flex flex-col gap-2 md:hidden">
        <For each={Array.from({ length: 3 })}>
          {() => (
            <>
              <Skeleton class="h-4 w-40" />
              <Skeleton class="h-10 w-full" />
            </>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Requests ────────────────────────────────────────────────────────────

/** Icon swaps Copy → Check for 2s; the button is the feedback, so no toast. */
export function CopyLinkButton(props: {
  value: string;
  label: string;
  copiedMessage: string;
  announce: (message: string) => void;
  onFailed: () => void;
  class?: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      props.announce(props.copiedMessage);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onFailed();
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      class={cn(btnSecondary, "min-h-11 px-3 text-sm", props.class)}
    >
      <span class="relative grid size-4 place-items-center">
        <IconCopy
          aria-hidden="true"
          class={cn(
            "absolute size-4 transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
            copied() && "opacity-0",
          )}
        />
        <IconCheck
          aria-hidden="true"
          class={cn(
            "absolute size-4 text-success transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none",
            !copied() && "opacity-0",
          )}
        />
      </span>
      {copied() ? "Copied" : props.label}
    </button>
  );
}

/** Square mark for the other side of the meeting: logo, else their initial. */
function PartyMark(props: { meeting: Meeting }) {
  const logo = () =>
    props.meeting.direction === "outgoing"
      ? props.meeting.business?.logo
      : null;
  return (
    <Show
      when={logo()}
      fallback={
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft font-display text-sm font-semibold text-primary"
        >
          {counterparty(props.meeting).charAt(0).toUpperCase()}
        </span>
      }
    >
      {(src) => (
        <img
          src={src()}
          alt=""
          class="size-10 shrink-0 rounded-md object-cover"
        />
      )}
    </Show>
  );
}

export function RequestCard(props: {
  meeting: Meeting;
  pending: boolean;
  onDecide: (meeting: Meeting, action: "accept" | "reject") => void;
  announce: (message: string) => void;
  onCopyFailed: () => void;
}) {
  const m = () => props.meeting;
  return (
    <li
      class={cn(
        cardClass,
        "animate-in fade-in-0 duration-[var(--duration-fast)] motion-reduce:animate-none",
        props.pending && "opacity-60",
      )}
    >
      <div class="flex items-start gap-3">
        <PartyMark meeting={m()} />
        <div class="min-w-0 flex-1">
          <h3 class="font-display text-base font-semibold text-text">
            {counterparty(m())}
          </h3>
          <p class="mt-0.5 font-mono text-sm tabular-nums text-text-muted">
            {meetingWhen(m())}
          </p>
        </div>
        <StatusChip status={m().status} />
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        <CategoryChip category={m().category} />
        <DirectionChip direction={m().direction} />
      </div>

      <Show when={counterpartyEmail(m())}>
        {(email) => (
          <p class="mt-2 truncate text-sm text-text-muted">{email()}</p>
        )}
      </Show>

      <Show when={m().message}>
        {(message) => (
          <p class="mt-3 rounded-sm bg-background px-3 py-2 text-sm text-pretty text-text">
            {message()}
          </p>
        )}
      </Show>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Show when={canDecide(m())}>
          <button
            type="button"
            disabled={props.pending}
            onClick={() => props.onDecide(m(), "accept")}
            class={cn(
              btnPrimary,
              "min-h-11 px-4 text-sm disabled:cursor-progress disabled:opacity-80",
            )}
          >
            <Show when={props.pending} fallback={<IconCheck class="size-4" />}>
              <Spinner class="size-4" />
            </Show>
            Accept
          </button>
          <button
            type="button"
            disabled={props.pending}
            onClick={() => props.onDecide(m(), "reject")}
            class={cn(
              btnSecondary,
              "min-h-11 px-4 text-sm disabled:cursor-progress disabled:opacity-80",
            )}
          >
            <IconX aria-hidden="true" class="size-4" />
            Decline
          </button>
        </Show>

        <Show when={m().status === "accepted" && m().meetUri}>
          {(uri) => (
            <>
              <a
                href={uri()}
                target="_blank"
                rel="noopener noreferrer"
                class={cn(btnPrimary, "min-h-11 px-4 text-sm")}
              >
                <IconVideo aria-hidden="true" class="size-4" />
                Join
                <IconExternalLink aria-hidden="true" class="size-3.5" />
                <span class="sr-only">(opens in a new tab)</span>
              </a>
              <CopyLinkButton
                value={uri()}
                label="Copy Meet link"
                copiedMessage={`Meet link for ${counterparty(m())} copied`}
                announce={props.announce}
                onFailed={props.onCopyFailed}
              />
            </>
          )}
        </Show>

        <Show when={m().status === "accepted" && !m().meetUri}>
          <p class="flex items-center gap-1.5 text-sm text-text-muted">
            <IconVideo aria-hidden="true" class="size-4" />
            No Meet link — connect Google in Settings to get one automatically.
          </p>
        </Show>

        <Show when={m().direction === "outgoing" && m().status === "pending"}>
          <p class="flex items-center gap-1.5 text-sm text-text-muted">
            <IconClock aria-hidden="true" class="size-4" />
            Waiting for {counterparty(m())} to reply.
          </p>
        </Show>
      </div>
    </li>
  );
}

export function RequestsSkeleton(props: { rows?: number }) {
  return (
    <div aria-busy="true" class="flex flex-col gap-3">
      <span class="sr-only">Loading meeting requests…</span>
      <For each={Array.from({ length: props.rows ?? 3 })}>
        {() => (
          <div class={cardClass}>
            <div class="flex items-start gap-3">
              <Skeleton class="size-10 shrink-0 rounded-md" />
              <div class="flex flex-1 flex-col gap-2">
                <Skeleton class="h-4 w-2/5" />
                <Skeleton class="h-3.5 w-3/5 opacity-70" />
              </div>
              <Skeleton class="h-5 w-24 rounded-full" />
            </div>
            <Skeleton class="mt-4 h-11 w-40" />
          </div>
        )}
      </For>
    </div>
  );
}

// ─── Decide a request ────────────────────────────────────────────────────

/**
 * Accepting mails the requester and creates a Meet link; declining frees the
 * slot for someone else. Neither can be undone from this page, so both
 * confirm first (spec §6, "accept/reject with confirm").
 */
export function DecisionDialog(props: {
  decision: { meeting: Meeting; action: "accept" | "reject" } | null;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const accepting = () => props.decision?.action === "accept";
  return (
    <Dialog.Root
      open={Boolean(props.decision)}
      role="alertdialog"
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Content class="w-full max-w-[440px] rounded-lg bg-surface p-6 text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95">
            <Show when={props.decision}>
              {(decision) => (
                <>
                  <span
                    class={cn(
                      "grid size-11 place-items-center rounded-full",
                      accepting()
                        ? "bg-success/10 text-success"
                        : "bg-error/10 text-error",
                    )}
                  >
                    <Show
                      when={accepting()}
                      fallback={<IconX aria-hidden="true" class="size-5" />}
                    >
                      <IconCheck aria-hidden="true" class="size-5" />
                    </Show>
                  </span>
                  <Dialog.Title class="mt-4 font-display text-lg font-semibold">
                    {accepting()
                      ? "Accept this meeting?"
                      : "Decline this meeting?"}
                  </Dialog.Title>
                  <Dialog.Description class="mt-2 text-base text-text-muted">
                    <span class="font-medium text-text">
                      {counterparty(decision().meeting)}
                    </span>{" "}
                    ·{" "}
                    <span class="font-mono tabular-nums">
                      {meetingWhen(decision().meeting)}
                    </span>
                    <br />
                    {accepting()
                      ? "They'll be emailed the confirmation, with a Google Meet link if your Google account is connected."
                      : "They'll be told it didn't work out, and the slot opens up for someone else."}
                  </Dialog.Description>

                  <Show when={props.error}>
                    {(error) => (
                      <div class="mt-4">
                        <Notice tone="error">{error()}</Notice>
                      </div>
                    )}
                  </Show>

                  <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Dialog.CloseTrigger class={cn(btnSecondary, "min-h-11")}>
                      Cancel
                    </Dialog.CloseTrigger>
                    <button
                      type="button"
                      disabled={props.pending}
                      onClick={() => props.onConfirm()}
                      class={cn(
                        btnPrimary,
                        "min-h-11 disabled:cursor-progress disabled:opacity-80",
                        !accepting() && "bg-error text-surface",
                      )}
                    >
                      <Show when={props.pending}>
                        <Spinner class="size-4" />
                      </Show>
                      {accepting() ? "Accept meeting" : "Decline meeting"}
                    </button>
                  </div>
                </>
              )}
            </Show>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Open availability ───────────────────────────────────────────────────

/**
 * Rebuilds bookable slots over a date range, on the weekdays the owner picks.
 * The days start from the saved working days but are editable here, so a
 * one-off Saturday — or a week where only Wednesday is free — needs no trip to
 * Settings. Only the picked days are rebuilt, and booked slots always survive.
 */
export function AvailabilityDialog(props: {
  open: boolean;
  start: string;
  end: string;
  /** Weekday numbers, 0 = Sunday. */
  days: number[];
  /** Days that are open in the saved settings, shown as a hint on the chips. */
  workingDays: number[];
  pending: boolean;
  error: string;
  /** Slots one picked day yields; 0 while the settings are still loading. */
  slotsPerDay: number;
  bookingWindow?: string;
  slotDuration?: number;
  onChange: (next: { start?: string; end?: string }) => void;
  onToggleDay: (day: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const dayCount = () => matchingDayCount(props.start, props.end, props.days);
  const slotCount = () => dayCount() * props.slotsPerDay;

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Content class="w-full max-w-[480px] rounded-lg bg-surface p-6 text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95">
            <span class="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
              <IconCalendarPlus aria-hidden="true" class="size-5" />
            </span>
            <Dialog.Title class="mt-4 font-display text-lg font-semibold">
              Open slots for booking
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-base text-text-muted">
              Pick the dates and the days of the week to open. Anything already
              booked is kept; free slots on the days you pick are rebuilt, and
              days you leave off are untouched.
            </Dialog.Description>

            <form
              class="mt-5 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                props.onSubmit();
              }}
            >
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1.5">
                  <span class={labelClass}>From</span>
                  <input
                    type="date"
                    required
                    value={props.start}
                    onInput={(e) =>
                      props.onChange({ start: e.currentTarget.value })
                    }
                    class={inputBase}
                  />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class={labelClass}>To</span>
                  <input
                    type="date"
                    required
                    value={props.end}
                    onInput={(e) =>
                      props.onChange({ end: e.currentTarget.value })
                    }
                    class={inputBase}
                  />
                </label>
              </div>

              <fieldset class="flex flex-col gap-2">
                <legend class={cn(labelClass, "mb-2")}>Days to open</legend>
                <div class="flex flex-wrap gap-1.5">
                  <For each={WEEKDAYS}>
                    {(day) => {
                      const on = () => props.days.includes(day.value);
                      const usual = () => props.workingDays.includes(day.value);
                      return (
                        <button
                          type="button"
                          aria-pressed={on()}
                          onClick={() => props.onToggleDay(day.value)}
                          class={cn(
                            "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
                            on()
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border-strong text-text-muted hover:bg-primary-soft hover:text-text",
                            focusRing,
                          )}
                        >
                          <span aria-hidden="true">{day.short}</span>
                          <span class="sr-only">
                            {day.label}
                            {usual() ? "" : " (not one of your working days)"}
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </fieldset>

              <p class="text-sm text-text-muted">
                <Show when={props.bookingWindow}>
                  Each open day is bookable {props.bookingWindow}
                  <Show when={props.slotDuration}>
                    {" "}
                    in{" "}
                    <span class="font-mono tabular-nums">
                      {props.slotDuration}
                    </span>
                    -minute slots
                  </Show>
                  ; change the hours in Settings.{" "}
                </Show>
                Ranges can cover up to{" "}
                <span class="font-mono tabular-nums">{MAX_GENERATE_DAYS}</span>{" "}
                days.
              </p>

              <Show when={props.days.length > 0 && dayCount() > 0}>
                <p
                  aria-live="polite"
                  class="rounded-sm bg-primary-soft px-3 py-2 text-sm text-primary"
                >
                  Opens <span class="font-mono tabular-nums">{dayCount()}</span>{" "}
                  {dayCount() === 1 ? "day" : "days"}
                  <Show when={props.slotsPerDay > 0}>
                    {" "}
                    · <span class="font-mono tabular-nums">{slotCount()}</span>{" "}
                    {slotCountLabel(slotCount())}
                  </Show>
                  .
                </p>
              </Show>

              <Show when={props.error}>
                {(error) => <Notice tone="error">{error()}</Notice>}
              </Show>

              <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.CloseTrigger class={cn(btnSecondary, "min-h-11")}>
                  Cancel
                </Dialog.CloseTrigger>
                <button
                  type="submit"
                  disabled={props.pending}
                  class={cn(
                    btnPrimary,
                    "min-h-11 disabled:cursor-progress disabled:opacity-80",
                  )}
                >
                  <Show when={props.pending}>
                    <Spinner class="size-4" />
                  </Show>
                  Open slots
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────

/** Count badge in a tab, so an empty list is visible before opening it. */
export function TabCount(props: { value: number }) {
  return (
    <span class="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary">
      {props.value}
    </span>
  );
}

/** Week summary under the calendar: free vs booked, in words and numbers. */
export function WeekSummary(props: { slots: Slot[]; start: Date }) {
  const inWeek = () => {
    const keys = new Set(weekDays(props.start).map(dayKey));
    return props.slots.filter((s) => keys.has(s.date.slice(0, 10)));
  };
  const booked = () => inWeek().filter((s) => s.isBooked).length;
  const free = () => inWeek().length - booked();

  return (
    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
      <Switch>
        <Match when={inWeek().length === 0}>
          <span class="flex items-center gap-1.5">
            <IconCalendarOff aria-hidden="true" class="size-4" />
            No slots open this week
          </span>
        </Match>
        <Match when={true}>
          <span>
            <span class="font-mono tabular-nums text-text">{free()}</span> free{" "}
            {slotCountLabel(free())}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span class="font-mono tabular-nums text-text">{booked()}</span>{" "}
            booked
          </span>
        </Match>
      </Switch>
    </p>
  );
}

export function SectionHeading(props: {
  id: string;
  title: string;
  lead?: string;
  action?: JSX.Element;
}) {
  return (
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h2
          id={props.id}
          class="font-display text-lg font-semibold text-text md:text-xl"
        >
          {props.title}
        </h2>
        <Show when={props.lead}>
          <p class="mt-1 max-w-[60ch] text-sm text-pretty text-text-muted">
            {props.lead}
          </p>
        </Show>
      </div>
      {props.action}
    </div>
  );
}
