import Check from "lucide-solid/icons/check";
import { createSignal } from "solid-js";
import { pricingTiers } from "~/constants/landing";
import { cn } from "~/lib/cn";

export default function PricingSection() {
  const [annual, setAnnual] = createSignal(false);

  const formatPrice = (monthly: number | null, annualPrice: number | null) => {
    if (monthly === null || annualPrice === null) return null;
    if (monthly === 0) return { amount: "Free", period: "" };
    if (annual()) {
      const monthlyEquiv = Math.round(annualPrice / 12);
      return {
        amount: `$${monthlyEquiv}`,
        period: "/mo",
        note: `$${annualPrice} billed annually`,
      };
    }
    return { amount: `$${monthly}`, period: "/mo", note: null };
  };

  const savingsPercent = (monthly: number, annualPrice: number) => {
    if (monthly === 0) return 0;
    const annualTotal = monthly * 12;
    return Math.round(((annualTotal - annualPrice) / annualTotal) * 100);
  };

  return (
    <section class="bg-background px-4 py-20 md:px-8 md:py-28">
      <div class="mx-auto max-w-[1120px]">
        <div class="mx-auto mb-12 max-w-2xl text-center">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
            Pricing
          </p>
          <h1 class="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Simple, transparent pricing
          </h1>
          <p class="mt-3 text-base leading-[1.6] text-muted-foreground">
            Choose the plan that fits your business. Upgrade or downgrade
            anytime.
          </p>
        </div>

        {/* Billing Toggle */}
        <div class="mb-12 flex min-h-11 items-center justify-center gap-4">
          <span
            class={cn(
              "text-sm font-medium",
              !annual() ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual()}
            aria-label="Toggle annual billing"
            onClick={() => setAnnual((prev) => !prev)}
            class={cn(
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-opacity duration-[180ms] motion-reduce:transition-none",
              annual() ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              class={cn(
                "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none",
                annual() ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
          <span
            class={cn(
              "text-sm font-medium",
              annual() ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Annual
          </span>
          {annual() && (
            <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Save up to 17%
            </span>
          )}
        </div>

        {/* Pricing Cards — static (DS §4 Tier 1 only, no tilt/reveal). */}
        <div class="grid gap-6 md:grid-cols-3">
          {pricingTiers.map((tier) => {
            const price = formatPrice(tier.monthlyPrice, tier.annualPrice);
            const discount =
              tier.monthlyPrice && tier.annualPrice
                ? savingsPercent(tier.monthlyPrice, tier.annualPrice)
                : 0;

            return (
              <div
                class={cn(
                  "relative flex flex-col rounded-xl border p-8 shadow-sm",
                  tier.highlighted
                    ? "border-primary bg-card shadow-md ring-1 ring-primary/10"
                    : "border-border bg-card",
                )}
              >
                {tier.badge && (
                  <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                    {tier.badge}
                  </div>
                )}

                <div class="mb-6">
                  <h2 class="mb-2 font-heading text-xl font-semibold text-card-foreground">
                    {tier.name}
                  </h2>
                  <p class="text-sm leading-[1.6] text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                <div class="mb-8">
                  {price ? (
                    <div class="flex items-baseline gap-1">
                      <span class="tnum font-heading text-4xl font-semibold text-card-foreground">
                        {price.amount}
                      </span>
                      {price.period && (
                        <span class="text-sm text-muted-foreground">
                          {price.period}
                        </span>
                      )}
                    </div>
                  ) : null}
                  {price?.note && (
                    <p class="tnum mt-1 text-xs text-muted-foreground">
                      {price.note}
                    </p>
                  )}
                  {annual() && discount > 0 && (
                    <p class="tnum mt-1 text-xs font-medium text-secondary">
                      Save {discount}% vs monthly
                    </p>
                  )}
                </div>

                <ul class="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li class="flex items-start gap-3 text-sm text-card-foreground">
                      <Check
                        size={18}
                        class="mt-0.5 shrink-0 text-secondary"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  class={cn(
                    "inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-sm font-medium shadow-sm transition-opacity duration-[180ms] motion-reduce:transition-none",
                    tier.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                      : "border border-input bg-card text-card-foreground hover:bg-muted",
                  )}
                  href={tier.ctaHref}
                >
                  {tier.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
