import { howItWorksSteps } from "~/constants/landing";

export default function HowItWorksSection() {
  return (
    <section
      class="border-y border-border bg-card px-4 py-20 md:px-8 md:py-28"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div class="mx-auto max-w-[1120px]">
        <div class="mx-auto mb-12 max-w-2xl text-center">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
            From QR scan to 5 stars
          </p>
          <h2
            id="how-it-works-heading"
            class="font-heading text-2xl font-semibold text-foreground md:text-3xl"
          >
            How Flonion works
          </h2>
          <p class="mt-3 text-base leading-[1.6] text-muted-foreground">
            The customer loop takes under a minute; your reply loop takes even
            less.
          </p>
        </div>
        <ol class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map((item) => (
            <li class="rounded-xl border border-border bg-background p-8 shadow-sm">
              <p
                class="tnum mb-4 grid size-11 place-items-center rounded-full bg-primary font-heading text-lg font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {item.step}
              </p>
              <h3 class="font-heading text-lg font-medium text-card-foreground">
                {item.title}
              </h3>
              <p class="mt-2 text-sm leading-[1.6] text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
