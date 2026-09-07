import Check from "lucide-solid/icons/check";
import { createSignal, onCleanup, onMount } from "solid-js";
import { pricingTiers } from "~/constants/landing";

export default function PricingSection() {
  const [annual, setAnnual] = createSignal(false);
  const [visible, setVisible] = createSignal(false);
  let sectionRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!sectionRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sectionRef);
    onCleanup(() => observer.disconnect());
  });

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
    <section class="bg-card px-4 py-24 md:px-16" ref={sectionRef}>
      <div class="mx-auto max-w-[1280px]">
        <div class="mx-auto mb-16 max-w-2xl text-center">
          <h2 class="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p class="text-lg text-muted-foreground">
            Choose the plan that fits your business. Upgrade or downgrade
            anytime.
          </p>
        </div>

        {/* Billing Toggle */}
        <div class="mb-16 flex items-center justify-center gap-4">
          <span
            class={`text-sm font-semibold transition-colors ${!annual() ? "text-foreground" : "text-muted-foreground"}`}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual()}
            onClick={() => setAnnual((prev) => !prev)}
            class={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              annual() ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              class={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
                annual() ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            class={`text-sm font-semibold transition-colors ${annual() ? "text-foreground" : "text-muted-foreground"}`}
          >
            Annual
          </span>
          {annual() && (
            <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Save up to 17%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div class="grid gap-8 md:grid-cols-3">
          {pricingTiers.map((tier, index) => {
            const price = formatPrice(tier.monthlyPrice, tier.annualPrice);
            const discount =
              tier.monthlyPrice && tier.annualPrice
                ? savingsPercent(tier.monthlyPrice, tier.annualPrice)
                : 0;

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: the tilt is a pointer-only flourish on a static card; the tier's real controls are the buttons inside it
              <div
                class={`tilt-card relative flex flex-col rounded-2xl border p-8 shadow-md transition-all duration-300 will-change-transform ${
                  tier.highlighted
                    ? "border-primary bg-card shadow-lg ring-1 ring-primary/10"
                    : "border-border bg-card"
                } ${
                  visible()
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-7"
                }`}
                style={{ "transition-delay": `${index * 100}ms` }}
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  if (window.innerWidth < 768) return;
                  const rect = el.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  const rotateX = (0.5 - y) * 6;
                  const rotateY = (x - 0.5) * 8;
                  el.style.setProperty("--mx", `${x * 100}%`);
                  el.style.setProperty("--my", `${y * 100}%`);
                  el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -4px, 0)`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = "";
                  el.style.setProperty("--mx", "50%");
                  el.style.setProperty("--my", "50%");
                }}
              >
                {tier.badge && (
                  <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">
                    {tier.badge}
                  </div>
                )}

                <div class="mb-6">
                  <h3 class="mb-2 text-xl font-bold text-card-foreground">
                    {tier.name}
                  </h3>
                  <p class="text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                <div class="mb-8">
                  {price ? (
                    <div class="flex items-baseline gap-1">
                      <span class="text-4xl font-extrabold tracking-tight text-card-foreground">
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
                    <p class="mt-1 text-xs text-muted-foreground">
                      {price.note}
                    </p>
                  )}
                  {annual() && discount > 0 && (
                    <p class="mt-1 text-xs text-primary">
                      Save {discount}% vs monthly
                    </p>
                  )}
                </div>

                <ul class="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li class="flex items-start gap-3 text-sm text-card-foreground">
                      <Check
                        size={18}
                        class="mt-0.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  class={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] ${
                    tier.highlighted
                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary-hover"
                      : "border border-border bg-card text-card-foreground hover:bg-muted"
                  }`}
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
