import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconMessageReply,
  IconStar,
} from "@tabler/icons-solidjs";
import { For } from "solid-js";
import { AiMarker, RatingPill } from "./brand";

/*
 * Stand-in for hero slot H1 (product screenshot). It is built from the real
 * design tokens so it stays sharp and themable; swap in an AVIF screenshot
 * with fetchpriority="high" once the dashboard is final.
 */

const KPIS = [
  { label: "Avg. rating", value: "4.6", delta: "up 0.2" },
  { label: "Reviews · Sep", value: "38", delta: "up 12" },
  { label: "QR scans", value: "214", delta: "up 31" },
  { label: "Reply rate", value: "92%", delta: "up 6 pts" },
];

const REVIEWS = [
  {
    name: "Priya S.",
    rating: 5,
    text: "Paneer tikka was perfect and the staff remembered our order.",
    sentiment: "Positive",
    icon: IconCircleCheck,
    tone: "text-success",
  },
  {
    name: "Rahul M.",
    rating: 3,
    text: "Food was good but we waited 25 minutes on Saturday night.",
    sentiment: "Mixed",
    icon: IconAlertTriangle,
    tone: "text-warning",
  },
  {
    name: "Anita K.",
    rating: 2,
    text: "Parking was a problem and nobody picked up the phone.",
    sentiment: "Negative",
    icon: IconCircleX,
    tone: "text-error",
  },
];

export function HeroMock() {
  return (
    <figure class="relative sm:pb-12 sm:pl-20 lg:pl-16">
      <figcaption class="sr-only">
        Flonion dashboard showing a 4.6 average rating and three reviews
        awaiting reply, next to the public review page on a phone.
      </figcaption>

      {/* Laptop: dashboard */}
      <div
        aria-hidden="true"
        class="relative rounded-xl border border-border bg-surface p-2 shadow-[0_24px_60px_rgb(28_25_23/0.14)]"
      >
        <div class="flex items-center gap-1.5 px-2 pt-1 pb-2">
          <span class="size-2.5 rounded-full bg-border" />
          <span class="size-2.5 rounded-full bg-border" />
          <span class="size-2.5 rounded-full bg-border" />
          <span class="ml-3 truncate rounded-sm bg-background px-2 py-0.5 text-xs text-text-muted">
            app.flonion.com/dashboard
          </span>
        </div>
        <div class="rounded-lg bg-background p-3 sm:p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs text-text-muted">Good morning</p>
              <p class="font-display text-base font-semibold text-text">
                Swaad Restaurant
              </p>
            </div>
            <span class="rounded-md bg-primary px-2.5 py-1.5 font-display text-xs font-semibold text-primary-foreground">
              New review request
            </span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <For each={KPIS}>
              {(kpi) => (
                <div class="rounded-md border border-border bg-surface p-2.5">
                  <p class="text-xs text-text-muted">{kpi.label}</p>
                  <p class="font-mono text-lg font-medium tabular-nums text-text">
                    {kpi.value}
                  </p>
                  <p class="text-xs text-success">▲ {kpi.delta}</p>
                </div>
              )}
            </For>
          </div>

          <div class="mt-3 rounded-md border border-border bg-surface">
            <p class="border-b border-border px-3 py-2 font-display text-sm font-semibold text-text">
              Needs attention
            </p>
            <ul>
              <For each={REVIEWS}>
                {(r) => (
                  <li class="flex items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-medium text-text">
                          {r.name}
                        </span>
                        <RatingPill rating={r.rating} class="py-0.5 text-xs" />
                        <span
                          class={`inline-flex items-center gap-1 text-xs font-medium ${r.tone}`}
                        >
                          <r.icon class="size-3.5" />
                          {r.sentiment}
                        </span>
                      </div>
                      <p class="mt-0.5 truncate text-xs text-text-muted">
                        {r.text}
                      </p>
                    </div>
                    <span class="hidden shrink-0 items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-xs font-medium text-text sm:inline-flex">
                      <IconMessageReply class="size-3.5" />
                      Draft reply
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>
      </div>

      {/* Phone: public review page */}
      <div
        aria-hidden="true"
        class="absolute bottom-0 left-0 hidden w-44 rounded-[1.75rem] border-4 border-text bg-surface p-3 shadow-[0_24px_48px_rgb(28_25_23/0.22)] sm:block lg:-left-6 md:w-48"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div class="flex items-center gap-2">
          <span class="grid size-7 place-items-center rounded-md bg-primary-soft font-display text-xs font-semibold text-primary">
            S
          </span>
          <span class="font-display text-xs font-semibold text-text">
            Swaad Restaurant
          </span>
        </div>
        <p class="mt-3 text-center font-display text-xs font-medium text-text">
          How was your visit?
        </p>
        <div class="mt-1.5 flex justify-center gap-0.5">
          <For each={[1, 2, 3, 4, 5]}>
            {(n) => (
              <IconStar
                class="size-5 stroke-accent"
                stroke-width={1.5}
                fill={n <= 4 ? "var(--star)" : "transparent"}
              />
            )}
          </For>
        </div>
        <p class="mt-1 text-center text-[10px] text-text-muted">
          4 of 5 – Very good
        </p>
        <div class="mt-2 rounded-md border border-border-strong p-2">
          <AiMarker class="text-[10px]" />
          <p class="mt-1 text-[10px] leading-snug text-text">
            Loved the biryani and quick service. Will come back with family.
          </p>
        </div>
        <span class="mt-2 block rounded-md bg-primary py-1.5 text-center font-display text-[11px] font-semibold text-primary-foreground">
          Continue
        </span>
      </div>
    </figure>
  );
}
