import { createSignal, createResource, Show, For } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { AlertTriangle, Loader2 } from "lucide-solid";
import PublicScheduleHeader from "~/components/company/bookings/PublicScheduleHeader";
import PublicScheduleCalendar from "~/components/company/bookings/PublicScheduleCalendar";

interface BusinessInfo {
  name: string;
  logo: string | null;
  sector: string | null;
  description: string | null;
  username: string | null;
  workingDays: string;
  workingStartTime: string;
  workingEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  slotDuration: number;
  timezone: string;
}

interface ScheduleEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
  title?: string | null;
}

interface ScheduleData {
  business: BusinessInfo;
  events: ScheduleEvent[];
}

function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  const pathParts = window.location.pathname.split("/");
  // /company/[username]/bookings -> parts = ["", "company", "username", "bookings"]
  return pathParts[2] || null;
}

async function fetchSchedule(): Promise<ScheduleData | null> {
  const username = getUsername();
  if (!username) return null;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  try {
    const res = await fetch(
      `/api/company/${encodeURIComponent(username)}/schedule?startDate=${formatDate(start)}&endDate=${formatDate(end)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function PublicBookingsPage() {
  const [data] = createResource(fetchSchedule);

  return (
    <>
      <Title>
        {data()
          ? `Schedule - ${data()!.business.name}`
          : "Schedule"}
      </Title>
      <Meta
        name="description"
        content={
          data()
            ? `View available meeting slots for ${data()!.business.name}. All times in IST (UTC+5:30).`
            : "View available meeting slots."
        }
      />

      <div class="min-h-dvh bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-4xl">
          <Show
            when={!data.loading}
            fallback={
              <div class="flex flex-col items-center justify-center py-20 animate-[fade-in-up_0.4s_ease-out_both]">
                <div class="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <Loader2 class="size-5 animate-spin text-muted-foreground" />
                </div>
                <p class="text-sm text-muted-foreground">Loading schedule...</p>
              </div>
            }
          >
            <Show
              when={data()}
              fallback={
                <div class="flex flex-col items-center justify-center py-20 animate-[fade-in-up_0.4s_ease-out_both]">
                  <div class="mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive-muted">
                    <AlertTriangle class="size-7 text-destructive" />
                  </div>
                  <h1 class="font-heading text-xl font-semibold text-foreground">
                    Schedule Not Found
                  </h1>
                  <p class="mt-2 text-sm text-muted-foreground">
                    This business does not have a published schedule, or the link is invalid.
                  </p>
                </div>
              }
            >
              <div class="flex flex-col gap-6">
                <PublicScheduleHeader business={data()!.business} />
                <PublicScheduleCalendar
                  events={data()!.events}
                  bookingStartTime={data()!.business.bookingStartTime}
                  bookingEndTime={data()!.business.bookingEndTime}
                  slotDuration={data()!.business.slotDuration}
                />
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </>
  );
}
