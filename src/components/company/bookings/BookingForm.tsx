import {
  CheckCircle2,
  Download,
  Mail,
  MessageSquare,
  Phone,
  User,
  Video,
  X,
} from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { generateIcsInvite } from "~/lib/ics";

interface ScheduleEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
  title?: string | null;
}

interface BookingFormProps {
  slot: ScheduleEvent;
  businessId: string;
  businessName: string;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLASS =
  "w-full rounded-control border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

function BookingForm(props: BookingFormProps) {
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  // Returned by the booking API when the business has Meet connected.
  const [meetLink, setMeetLink] = createSignal<string | null>(null);

  const slotDate = () =>
    new Date(`${props.slot.date}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  /** "HH:MM" or "h:mm AM/PM" → Date; null when the format is unknown. */
  const parseSlotDateTime = (date: string, time: string): Date | null => {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP])\.?\s*M\.?)?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "P" && h < 12) h += 12;
    if (ampm === "A" && h === 12) h = 0;
    const d = new Date(
      `${date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /** Client-side ICS (RFC 5545) so guests can save a pending request. */
  const icsHref = createMemo(() => {
    const start = parseSlotDateTime(props.slot.date, props.slot.startTime);
    const end = parseSlotDateTime(props.slot.date, props.slot.endTime);
    if (!start || !end) return null;
    try {
      const { raw } = generateIcsInvite({
        summary: `Meeting with ${props.businessName}`,
        description:
          message().trim() ||
          `Meeting request with ${props.businessName}. Awaiting confirmation.`,
        organizer: { name: props.businessName, email: "" },
        attendees: [{ name: name().trim(), email: email().trim() }],
        start,
        end,
      });
      return `data:text/calendar;charset=utf-8,${encodeURIComponent(raw)}`;
    } catch {
      return null;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);

    if (!name().trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email().trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!phone().trim()) {
      setError("Please enter your phone number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/company/${encodeURIComponent(props.username)}/bookings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: props.slot.id,
            name: name().trim(),
            email: email().trim(),
            phone: phone().trim(),
            message: message().trim() || undefined,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMeetLink(
        typeof data?.meetUri === "string"
          ? data.meetUri
          : typeof data?.meetLink === "string"
            ? data.meetLink
            : null,
      );
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
      <div class="w-full max-w-md rounded-soft border border-border/60 bg-card shadow-xl animate-[fade-in-up_0.3s_ease-out]">
        <Show
          when={!submitted()}
          fallback={
            <div class="p-8 text-center">
              <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-muted">
                <CheckCircle2 class="size-7 text-success" aria-hidden="true" />
              </div>
              <h3 class="font-heading text-lg font-medium text-foreground">
                Request Submitted
              </h3>
              <p class="mt-2 text-sm text-muted-foreground">
                Your meeting request for <strong class="font-medium">{slotDate()}</strong> at{" "}
                <strong class="tnum font-medium">
                  {props.slot.startTime} - {props.slot.endTime}
                </strong>{" "}
                has been sent to {props.businessName}. You will receive an email
                once they respond.
              </p>
              <div class="mt-6 grid gap-2">
                <Show when={icsHref()}>
                  <a
                    href={icsHref()!}
                    download={`meeting-${props.slot.date}.ics`}
                    class="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
                  >
                    <Download class="size-4" aria-hidden="true" />
                    Add to calendar (.ics)
                  </a>
                </Show>
                <Show when={meetLink()}>
                  <a
                    href={meetLink()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-medium text-primary transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
                  >
                    <Video class="size-4" aria-hidden="true" />
                    Join Google Meet
                  </a>
                </Show>
                <button
                  type="button"
                  onClick={props.onClose}
                  class="inline-flex h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity duration-[180ms] hover:bg-primary-hover motion-reduce:transition-none"
                >
                  Done
                </button>
              </div>
            </div>
          }
        >
          {/* Header */}
          <div class="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div>
              <h3 class="font-heading text-lg font-medium text-foreground">
                Book a Meeting
              </h3>
              <p class="mt-0.5 text-sm text-muted-foreground">
                {slotDate()} &middot; {props.slot.startTime} -{" "}
                {props.slot.endTime}
              </p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="grid size-8 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X class="size-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="p-6">
            <div class="flex flex-col gap-4">
              <div>
                <label
                  for="booking-name"
                  class="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <User class="size-3.5 text-muted-foreground" />
                  Full Name
                </label>
                <input
                  id="booking-name"
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="John Doe"
                  class={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  for="booking-email"
                  class="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Mail class="size-3.5 text-muted-foreground" />
                  Email Address
                </label>
                <input
                  id="booking-email"
                  type="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  placeholder="john@example.com"
                  class={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  for="booking-phone"
                  class="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Phone class="size-3.5 text-muted-foreground" />
                  Phone Number
                </label>
                <input
                  id="booking-phone"
                  type="tel"
                  value={phone()}
                  onInput={(e) => setPhone(e.currentTarget.value)}
                  placeholder="+1 (555) 000-0000"
                  class={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  for="booking-message"
                  class="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <MessageSquare class="size-3.5 text-muted-foreground" />
                  Message
                  <span class="text-xs text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="booking-message"
                  value={message()}
                  onInput={(e) => setMessage(e.currentTarget.value)}
                  placeholder="What would you like to discuss?"
                  rows={3}
                  class={`${INPUT_CLASS} resize-none`}
                />
              </div>
            </div>

            <Show when={error()}>
              <div
                role="alert"
                class="mt-4 rounded-card border border-destructive/25 bg-destructive-muted px-4 py-3 text-sm text-destructive"
              >
                {error()}
              </div>
            </Show>

            <Button
              type="submit"
              size="lg"
              loading={loading()}
              loadingLabel="Submitting…"
              class="mt-5 w-full"
            >
              Submit Request
            </Button>
          </form>
        </Show>
      </div>
    </div>
  );
}

export default BookingForm;
