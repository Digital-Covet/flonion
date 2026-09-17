import Camera from "lucide-solid/icons/camera";
import Sparkles from "lucide-solid/icons/sparkles";
import { type Component, For } from "solid-js";
import type { PhotoStatus } from "~/features/seo/seo-types";
import { cn } from "~/lib/cn";

interface PhotoStatusCardProps {
  status: PhotoStatus;
}

/* DS §2: bar colour is decorative — the count number beside it carries
   meaning, so this never relies on hue alone. */
function photoBarColor(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0;
  if (ratio >= 0.7) return "bg-success";
  if (ratio >= 0.4) return "bg-warning";
  return "bg-destructive";
}

const DOT: Record<string, string> = {
  Exterior: "bg-secondary",
  Interior: "bg-primary",
  Products: "bg-warning",
  Team: "bg-info",
};

const PhotoStatusCard: Component<PhotoStatusCardProps> = (props) => {
  const maxCount = () =>
    Math.max(...props.status.byCategory.map((c) => c.count), 1);

  return (
    <div class="h-full rounded-card border border-border bg-card p-5 shadow-sm">
      <div class="mb-4 flex items-center gap-3">
        <div class="grid size-10 place-items-center rounded-control bg-positive-muted text-primary">
          <Camera size={20} aria-hidden="true" />
        </div>
        <div>
          <h3 class="text-lg font-medium text-foreground">Photo status</h3>
          <p class="tnum text-xs text-muted-foreground">
            {props.status.total} photos total
          </p>
        </div>
      </div>

      <ul class="grid gap-3">
        <For each={props.status.byCategory}>
          {(item) => (
            <li>
              <div class="mb-1 flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5 font-medium text-foreground">
                  <span
                    class={`inline-block size-2 rounded-full ${DOT[item.category] ?? "bg-control"}`}
                    aria-hidden="true"
                  />
                  {item.category}
                </span>
                <span class="tnum text-muted-foreground">
                  {item.count} photos
                </span>
              </div>
              <div
                class="h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${item.category}: ${item.count} photos`}
              >
                <div
                  class={cn(
                    "h-full rounded-full",
                    photoBarColor(item.count, maxCount()),
                  )}
                  style={{ width: `${(item.count / maxCount()) * 100}%` }}
                />
              </div>
            </li>
          )}
        </For>
      </ul>

      <div class="mt-4 border-t border-border pt-3">
        <p class="text-xs text-muted-foreground" aria-live="polite">
          Last added:{" "}
          <time
            dateTime={props.status.lastAdded}
            class="tnum font-medium text-foreground"
          >
            {props.status.lastAdded}
          </time>
        </p>
      </div>

      <div class="mt-3 flex items-start gap-2 rounded-card bg-positive-muted p-3">
        <Sparkles
          size={14}
          class="mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <p class="text-xs leading-relaxed text-primary">
          {props.status.recommendation}
        </p>
      </div>
    </div>
  );
};

export default PhotoStatusCard;
