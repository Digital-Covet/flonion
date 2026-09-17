import { Briefcase, Clock } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { formatTimeInZone, tzLabel } from "~/lib/timezone-label";

interface BusinessInfo {
  name: string;
  logo: string | null;
  sector: string | null;
  description: string | null;
  username: string | null;
  timezone?: string | null;
}

interface PublicScheduleHeaderProps {
  business: BusinessInfo;
}

function PublicScheduleHeader(props: PublicScheduleHeaderProps) {
  const zone = () => props.business.timezone ?? null;
  const [currentTime, setCurrentTime] = createSignal(
    formatTimeInZone(new Date(), zone()),
  );

  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    setCurrentTime(formatTimeInZone(new Date(), zone()));
    interval = setInterval(() => {
      // Skip background-tab ticks (battery + reduced-motion friendly).
      if (!document.hidden)
        setCurrentTime(formatTimeInZone(new Date(), zone()));
    }, 1000);
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return (
    <div class="rounded-soft border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 animate-[fade-in-up_0.4s_ease-out_both]">
      <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <Show
          when={props.business.logo}
          fallback={
            <div class="flex size-20 shrink-0 items-center justify-center rounded-soft bg-linear-to-br from-primary/10 to-purple/10 font-heading text-3xl font-semibold text-primary sm:size-24">
              {props.business.name?.charAt(0) || "?"}
            </div>
          }
        >
          <img
            src={props.business.logo!}
            alt={`${props.business.name} logo`}
            class="size-20 shrink-0 rounded-soft object-cover shadow-md sm:size-24"
          />
        </Show>

        <div class="flex-1 text-center sm:text-left">
          <div class="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
            <h1 class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
              {props.business.name}
            </h1>
            <Show when={props.business.sector}>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Briefcase class="size-3" />
                {props.business.sector}
              </span>
            </Show>
          </div>

          <Show when={props.business.description}>
            <p class="mt-2 text-sm text-muted-foreground line-clamp-2">
              {props.business.description}
            </p>
          </Show>
        </div>
      </div>

      <div class="mt-5 border-t border-border/60 pt-4">
        <div class="flex items-center justify-center gap-2 sm:justify-start">
          <span class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <Clock class="size-4" aria-hidden="true" />
            <span class="tnum">
              {tzLabel(zone())} Current Time: {currentTime()}
            </span>
          </span>
          <span class="text-xs text-muted-foreground">
            {zone() ?? "Your local time"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PublicScheduleHeader;
