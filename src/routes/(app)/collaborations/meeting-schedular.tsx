import { clientOnly } from "@solidjs/start";
import { Loader2 } from "lucide-solid";
import { Suspense } from "solid-js";

const MeetingSchedulerApp = clientOnly(
  () =>
    import(
      "~/components/marketplace/collaborations/meeting-schedular/MeetingSchedulerApp"
    ),
);

export default function MeetingSchedulerPage() {
  return (
    <Suspense
      fallback={
        <div class="flex h-96 items-center justify-center">
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MeetingSchedulerApp
        fallback={
          <div class="flex h-96 items-center justify-center">
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      />
    </Suspense>
  );
}
