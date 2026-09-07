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

  const statusLabel = () =>
    meeting()?.status === "accepted" ? "Confirmed" : "Pending";

  const statusTone = () =>
    meeting()?.status === "accepted"
      ? ("primary" as const)
      : ("orange" as const);

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => {
        if (!details.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <Show when={meeting()}>
              {(m) => (
                <>
                  <header class="flex items-center justify-between border-b border-border px-6 py-4">
                    <div class="flex items-center gap-3 min-w-0">
                      <Show
                        when={m().business?.logo}
                        fallback={
                          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 class="size-5" />
                          </div>
                        }
                      >
                        <img
                          src={m().business.logo!}
                          alt={m().business.name}
                          class="size-10 shrink-0 rounded-lg object-cover"
                        />
                      </Show>
                      <div class="min-w-0">
                        <Dialog.Title class="font-heading text-lg font-semibold text-foreground truncate">
                          {m().business?.name || "Meeting Details"}
                        </Dialog.Title>
                        <p class="text-xs text-muted-foreground truncate">
                          {formatDate(m().slot.date)}
                        </p>
                      </div>
                    </div>
                    <Dialog.CloseTrigger class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <X class="size-4" />
                    </Dialog.CloseTrigger>
                  </header>

                  <div class="px-6 py-5 space-y-4">
                    <div class="flex items-center gap-4 text-sm text-muted-foreground">
                      <span class="flex items-center gap-1.5">
                        <Clock class="size-3.5" />
                        {m().slot.startTime} - {m().slot.endTime}
                      </span>
                      <span class="flex items-center gap-1.5">
                        <MapPin class="size-3.5" />
                        Online
                      </span>
                    </div>

                    <Show when={requesterName()}>
                      <div class="rounded-lg bg-muted/50 p-3">
                        <p class="mb-2 text-xs font-medium text-muted-foreground">
                          Meeting with
                        </p>
                        <div class="flex items-center gap-2.5">
                          <div class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                            {initial()}
                          </div>
                          <div class="min-w-0">
                            <p class="text-sm font-medium text-foreground truncate">
                              {requesterName()}
                            </p>
                            <Show when={requesterEmail()}>
                              <p class="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Mail class="size-3" />
                                {requesterEmail()}
                              </p>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </Show>

                    <Show when={hasGuestInfo()}>
                      <div class="rounded-lg bg-muted/50 p-3">
                        <p class="mb-2 text-xs font-medium text-muted-foreground">
                          Guest Information
                        </p>
                        <div class="space-y-1.5">
                          <Show when={m().guestName}>
                            <p class="text-sm text-foreground flex items-center gap-1.5">
                              <User class="size-3.5 text-muted-foreground" />
                              {m().guestName}
                            </p>
                          </Show>
                          <Show when={m().guestEmail}>
                            <p class="text-sm text-foreground flex items-center gap-1.5">
                              <Mail class="size-3.5 text-muted-foreground" />
                              {m().guestEmail}
                            </p>
                          </Show>
                          <Show when={m().guestPhone}>
                            <p class="text-sm text-foreground flex items-center gap-1.5">
                              <Phone class="size-3.5 text-muted-foreground" />
                              {m().guestPhone}
                            </p>
                          </Show>
                        </div>
                      </div>
                    </Show>

                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground">Status:</span>
                      <StatusBadge tone={statusTone()}>
                        {statusLabel()}
                      </StatusBadge>
                    </div>

                    <Show when={m().message}>
                      <div class="rounded-lg bg-muted/50 p-3">
                        <p class="mb-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare class="size-3.5" />
                          Message
                        </p>
                        <p class="text-sm text-foreground whitespace-pre-wrap">
                          {m().message}
                        </p>
                      </div>
                    </Show>
                  </div>

                  <footer class="flex justify-end border-t border-border px-6 py-4">
                    <Dialog.CloseTrigger class="rounded-lg px-4 py-2 text-sm font-medium text-foreground bg-muted transition-colors hover:bg-border">
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
