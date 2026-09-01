import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Clock, Briefcase } from "lucide-solid";

interface BusinessInfo {
  name: string;
  logo: string | null;
  sector: string | null;
  description: string | null;
  username: string | null;
}

interface PublicScheduleHeaderProps {
  business: BusinessInfo;
}

function formatISTTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function PublicScheduleHeader(props: PublicScheduleHeaderProps) {
  const [currentTime, setCurrentTime] = createSignal(formatISTTime(new Date()));

  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    interval = setInterval(() => {
      setCurrentTime(formatISTTime(new Date()));
    }, 1000);
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return (
    <div class="rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 animate-[fade-in-up_0.4s_ease-out_both]">
      <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <Show
          when={props.business.logo}
          fallback={
            <div class="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-purple/10 text-3xl font-bold text-primary sm:size-24">
              {props.business.name?.charAt(0) || "?"}
            </div>
          }
        >
          <img
            src={props.business.logo!}
            alt={`${props.business.name} logo`}
            class="size-20 shrink-0 rounded-2xl object-cover shadow-md sm:size-24"
          />
        </Show>

        <div class="flex-1 text-center sm:text-left">
          <div class="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
            <h1 class="font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
            <Clock class="size-4" />
            IST Current Time: {currentTime()}
          </span>
          <span class="text-xs text-muted-foreground">UTC+5:30</span>
        </div>
      </div>
    </div>
  );
}

export default PublicScheduleHeader;
