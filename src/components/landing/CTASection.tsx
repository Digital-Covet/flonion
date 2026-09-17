import { A } from "@solidjs/router";
import ArrowRight from "lucide-solid/icons/arrow-right";
import QrCode from "lucide-solid/icons/qr-code";
import Star from "lucide-solid/icons/star";

export default function CTASection() {
  return (
    <section
      class="bg-background px-4 pb-20 md:px-8 md:pb-28"
      aria-labelledby="cta-heading"
    >
      <div class="mx-auto max-w-[1120px] rounded-xl bg-primary px-8 py-12 text-primary-foreground shadow-md md:px-12 md:py-16">
        <div class="grid items-center gap-10 lg:grid-cols-[7fr_5fr]">
          <div class="text-center lg:text-left">
            <h2
              id="cta-heading"
              class="font-heading text-2xl font-semibold leading-tight md:text-3xl"
            >
              Ready to become the best-rated business on your street?
            </h2>
            <p class="mx-auto mt-3 max-w-md text-base leading-[1.6] text-primary-foreground/80 lg:mx-0">
              Print your QR today, collect your first reviews this week. Free
              14-day trial — no credit card required.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row lg:justify-start justify-center">
              <A
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-8 py-4 text-sm font-medium text-primary shadow-sm transition-opacity duration-[180ms] hover:opacity-90 motion-reduce:transition-none"
                href="/signup"
              >
                Start your free trial
                <ArrowRight size={18} aria-hidden="true" />
              </A>
              <A
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/40 px-8 py-4 text-sm font-medium text-white transition-opacity duration-[180ms] hover:bg-white/10 motion-reduce:transition-none"
                href="/pricing"
              >
                See pricing
              </A>
            </div>
          </div>

          {/* Static checklist card — no device mockup, no scroll animation. */}
          <div class="rounded-xl bg-white p-8 text-card-foreground shadow-sm">
            <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              First-run checklist
            </p>
            <ul class="mt-4 space-y-3 text-sm">
              <li class="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                <QrCode
                  size={18}
                  class="shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <strong class="font-medium">Print your QR</strong>
                  <span class="block text-xs text-muted-foreground">
                    A6 table stand, ready in 1 click
                  </span>
                </span>
              </li>
              <li class="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                <span class="flex shrink-0 text-star" aria-hidden="true">
                  <Star size={18} class="fill-star" />
                </span>
                <span>
                  <strong class="font-medium">Connect Google</strong>
                  <span class="block text-xs text-muted-foreground">
                    Inbox + replies in one place
                  </span>
                </span>
              </li>
              <li class="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                <span
                  class="tnum grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-white"
                  aria-hidden="true"
                >
                  3
                </span>
                <span>
                  <strong class="font-medium">Invite your team</strong>
                  <span class="block text-xs text-muted-foreground">
                    Everyone clears the inbox together
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
