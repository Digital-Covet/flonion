import { createSignal, onCleanup, onMount, Show } from "solid-js";

/**
 * E5a — public "Review saved — redirecting to Google in 5…4…3" interstitial.
 * CSS width-transition countdown bar, cancellable "Stay here" link.
 * Countdown announced once (not per-second); numbers are visual only.
 */
export function RedirectCountdown(props: {
  seconds?: number;
  targetLabel?: string;
  onRedirect: () => void;
  onStay?: () => void;
}) {
  const total = () => props.seconds ?? 5;
  const [remaining, setRemaining] = createSignal(total());
  const [stayed, setStayed] = createSignal(false);
  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (!stayed()) props.onRedirect();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  });
  onCleanup(() => clearInterval(interval));

  const widthPct = () => `${(remaining() / total()) * 100}%`;

  return (
    <div class="grid gap-2 rounded-soft border border-border bg-card p-4 text-center">
      <p class="text-sm font-medium text-foreground" aria-live="polite">
        Review saved — redirecting to {props.targetLabel ?? "Google"} in{" "}
        {remaining()}s
      </p>
      <div class="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          class="countdown-bar h-full rounded-full bg-primary motion-reduce:transition-none"
          style={{ width: widthPct() }}
        />
      </div>
      <Show when={props.onStay}>
        <button
          type="button"
          onClick={() => {
            setStayed(true);
            clearInterval(interval);
            props.onStay!();
          }}
          class="mx-auto h-9 rounded-control px-3 text-sm font-medium text-primary transition-opacity duration-[180ms] hover:bg-positive-muted motion-reduce:transition-none"
        >
          Stay here
        </button>
      </Show>
    </div>
  );
}

/**
 * E5b — submitted check. Static SVG by default; the Tier-2 dotLottie check
 * (≤30KB, lazy-loaded, autoplay once, no loop) may replace this behind a
 * `lazy()` import on the public-review success route only. Reduced motion
 * always renders this static check.
 */
export function SubmittedCheck(props: { class?: string; label?: string }) {
  return (
    <span
      role="img"
      aria-label={props.label ?? "Review submitted successfully"}
      class={`inline-grid size-12 place-items-center rounded-full bg-success-muted ${props.class ?? ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-6 text-success"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
