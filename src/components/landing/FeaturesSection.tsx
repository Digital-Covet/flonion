import { featureItems } from "~/constants/landing";
import { cn } from "~/lib/cn";

export default function FeaturesSection() {
  return (
    <section class="bg-background px-4 py-20 md:px-8 md:py-28" id="features">
      <div class="mx-auto max-w-[1120px]">
        <div class="mx-auto mb-12 max-w-2xl text-center">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
            Everything in one workspace
          </p>
          <h2 class="font-heading text-2xl font-semibold text-foreground md:text-3xl">
            Everything you need to grow locally
          </h2>
          <p class="mt-3 text-base leading-[1.6] text-muted-foreground">
            Reviews, replies, SEO, bookings, partners, and tasks — simple tools
            built for owners, not analysts.
          </p>
        </div>

        {/* Bento grid (DS §1): two lead tiles span 2 cols on lg; the rest
            are single tiles. Opaque cards, 12px radius, static reveal. */}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featureItems.map((feature) => (
            <article
              class={cn(
                "rounded-xl border border-border bg-card p-8 shadow-sm",
                feature.span && "md:col-span-2",
              )}
            >
              <div class="mb-5 flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <span class="grid size-11 place-items-center">
                  {feature.icon}
                </span>
              </div>
              <h3 class="font-heading text-xl font-medium text-card-foreground">
                {feature.title}
              </h3>
              <p class="mt-2 text-base leading-[1.6] text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
