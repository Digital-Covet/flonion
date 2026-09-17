import { Dialog } from "@ark-ui/solid/dialog";
import {
  Building2,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User,
  X,
} from "lucide-solid";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { counterpartyName, statusDisplay } from "./meeting-display";
import StatusBadge from "./StatusBadge";

export interface MeetingData {
  id: string;
  slot: { date: string; startTime: string; endTime: string };
  business: {
    id: string;
    name: string;
    logo: string | null;
    username: string | null;
  };
  requester: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    businessId?: string | null;
  } | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  category?: "partner" | "team";
  direction?: "incoming" | "outgoing";
}

interface MeetingDetailModalProps {
  open: boolean;
  meeting: MeetingData | null;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MeetingDetailModal(props: MeetingDetailModalProps) {
  const meeting = () => props.meeting;

  const requesterName = () =>
    meeting()?.requester?.name ||
    meeting()?.guestName ||
    meeting()?.requester?.email ||
    meeting()?.guestEmail ||
    "Guest";

  const requesterEmail = () =>
    meeting()?.requester?.email || meeting()?.guestEmail || "";

  const hasGuestInfo = () =>
    !meeting()?.requester && (meeting()?.guestName || meeting()?.guestEmail);

  const initial = () => requesterName().charAt(0)?.toUpperCase() ?? "?";

  const status = () => statusDisplay(meeting()?.status ?? "");

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
          <Dialog.Content class="e2-enter w-full max-w-md overflow-hidden rounded-t-soft border border-border bg-card shadow-lg sm:rounded-card">
            <Show when={meeting()}>
              {(m) => (
                <>
                  <header class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <div class="flex min-w-0 items-center gap-3">
                      <Show
                        when={m().business?.logo}
                        fallback={
                          <div class="grid size-10 shrink-0 place-items-center rounded-card bg-primary/10 text-primary">
                            <Building2 class="size-5" aria-hidden="true" />
                          </div>
                        }
                      >
                        <img
                          src={m().business.logo!}
                          alt={m().business.name}
                          class="size-10 shrink-0 rounded-card object-cover"
                        />
                      </Show>
                      <div class="min-w-0">
                        <Dialog.Title class="truncate font-heading text-lg font-semibold text-foreground">
                          {m().business?.name
                            ? counterpartyName(m())
                            : "Meeting Details"}
                        </Dialog.Title>
                        <p class="tnum truncate text-xs text-muted-foreground">
                          {formatDate(m().slot.date)}
                        </p>
                      </div>
                    </div>
                    <Dialog.CloseTrigger
                      aria-label="Close meeting details"
                      class="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <X class="size-5" aria-hidden="true" />
                    </Dialog.CloseTrigger>
                  </header>

                  <div class="grid gap-4 px-5 py-5">
                    <div class="tnum flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span class="inline-flex items-center gap-1.5">
                        <Clock class="size-3.5" aria-hidden="true" />
                        {m().slot.startTime} – {m().slot.endTime}
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <MapPin class="size-3.5" aria-hidden="true" />
                        Online
                      </span>
                    </div>

                    <Show when={requesterName()}>
                      <div class="rounded-card bg-muted/60 p-3.5">
                        <p class="mb-2 text-xs font-medium text-muted-foreground">
                          Meeting with
                        </p>
                        <div class="flex items-center gap-2.5">
                          <div
                            aria-hidden="true"
                            class="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                          >
                            {initial()}
                          </div>
                          <div class="min-w-0">
                            <p class="truncate text-sm font-medium text-foreground">
                              {requesterName()}
                            </p>
                            <Show when={requesterEmail()}>
                              <p class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <Mail
                                  class="size-3 shrink-0"
                                  aria-hidden="true"
                                />
                                {requesterEmail()}
                              </p>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </Show>

                    <Show when={hasGuestInfo()}>
                      <div class="rounded-card bg-muted/60 p-3.5">
                        <p class="mb-2 text-xs font-medium text-muted-foreground">
                          Guest Information
                        </p>
                        <div class="grid gap-1.5">
                          <Show when={m().guestName}>
                            <p class="flex items-center gap-1.5 text-sm text-foreground">
                              <User
                                class="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {m().guestName}
                            </p>
                          </Show>
                          <Show when={m().guestEmail}>
                            <p class="flex items-center gap-1.5 truncate text-sm text-foreground">
                              <Mail
                                class="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {m().guestEmail}
                            </p>
                          </Show>
                          <Show when={m().guestPhone}>
                            <p class="tnum flex items-center gap-1.5 text-sm text-foreground">
                              <Phone
                                class="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {m().guestPhone}
                            </p>
                          </Show>
                        </div>
                      </div>
                    </Show>

                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground">Status:</span>
                      <StatusBadge tone={status().tone}>
                        {status().label}
                      </StatusBadge>
                    </div>

                    <Show when={m().message}>
                      <div class="rounded-card bg-muted/60 p-3.5">
                        <p class="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <MessageSquare class="size-3.5" aria-hidden="true" />
                          Message
                        </p>
                        <p class="text-sm leading-6 whitespace-pre-wrap text-foreground">
                          {m().message}
                        </p>
                      </div>
                    </Show>
                  </div>

                  <footer class="flex justify-end border-t border-border px-5 py-4">
                    <Dialog.CloseTrigger class="inline-flex min-h-11 items-center rounded-control bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      Close
                    </Dialog.CloseTrigger>
                  </footer>
                </>
              )}
            </Show>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export default MeetingDetailModal;
