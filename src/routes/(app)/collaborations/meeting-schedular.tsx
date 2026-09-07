import { clientOnly } from "@solidjs/start";
import { Loader2 } from "lucide-solid";

const MeetingSchedulerApp = clientOnly(
  () =>
    import(
      "~/components/marketplace/collaborations/meeting-schedular/MeetingSchedulerApp"
    ),
);

export default function MeetingSchedulerPage() {
  return (
    <MeetingSchedulerApp
      fallback={
        <div class="flex h-96 items-center justify-center">
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    />
  );
}
