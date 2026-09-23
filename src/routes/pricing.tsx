import { A } from "@solidjs/router";
import { HttpHeader } from "@solidjs/start";
import {
  IconArrowRight,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-solidjs";
import { createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { OnionRings, SectionHeading } from "~/components/landing/brand";
import { Faq, type FaqItem } from "~/components/landing/Faq";
import { SiteFooter } from "~/components/landing/SiteFooter";
import {
  btnPrimary,
  btnSecondary,
  SiteHeader,
} from "~/components/landing/SiteHeader";
import { PageMeta } from "~/components/meta/PageMeta";
import {
  BillingToggle,
  CellValue,
  FeatureList,
  PlanPrice,
} from "~/components/plans/ui";
import { cn } from "~/lib/cn";
import { SUPPORT_EMAIL } from "~/lib/constants";
import {
  type Billing,
  COMPARISON,
  PLANS,
  type Plan,
  type PlanId,
} from "~/lib/plans";

const container = "mx-auto w-full max-w-[1200px] px-4 md:px-6";
const section = "py-16 md:py-24";

/** Marketing CTAs; the in-app `/upgrade` page has its own. */
const PLAN_CTA: Record<PlanId, { label: string; href: string }> = {
  starter: { label: "Start free", href: "/signup" },
  business: { label: "Choose Business", href: "/signup" },
  enterprise: { label: "Talk to us", href: `mailto:${SUPPORT_EMAIL}` },
};

const PRICING_FAQ: FaqItem[] = [
  {
    q: "Is the Starter plan really free?",
    a: "Yes. There is no card needed and no time limit. Upgrade to Business when you need more review links, AI drafts or team members.",
  },
  {
    q: "Do my customers need an app or an account?",
    a: "No. They scan your QR, pick their stars and write a few words in the browser. Posting happens on Google or the platform they choose.",
  },
  {
    q: "Does Flonion hide bad reviews?",
    a: "Never. Every customer sees the same “Post on Google” options whatever rating they give, and stars are never pre-filled. This keeps your reviews genuine and in line with Google's policies.",
  },
  {
    q: "What counts as an AI draft?",
    a: "Each set of reply drafts you generate in the inbox, and each set of writing suggestions a customer asks for, counts as one. Unused drafts don't roll over.",
  },
  {
    q: "How is Enterprise priced?",
    a: "Enterprise is quoted on the number of locations, team size and AI volume you need. Tell us about your business and we'll get back to you with a plan.",
  },
  {
    q: "Are prices inclusive of GST?",
    a: "Prices are shown per business location and exclude GST, which is added at checkout.",
  },
  {
    q: "Can I change plans or cancel?",
    a: "Yes, at any time from your settings. If you move down to Starter, your reviews and QR codes stay, and extra links are paused rather than deleted.",
  },
];

export default function Pricing() {
  const [billing, setBilling] = createSignal<Billing>("monthly");

  return (
    <>
      {/* Static marketing copy; see the note on the landing page. */}
      <HttpHeader
        name="Cache-Control"
        value="public, max-age=0, s-maxage=300, stale-while-revalidate=600"
      />
      <PageMeta
        title="Pricing – Flonion"
        description="Simple Flonion plans for local businesses: start free, then upgrade for unlimited review QR codes, more AI reply drafts and local SEO tools."
        path="/pricing"
      />

      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div class="min-h-screen bg-background font-sans text-text">
        <SiteHeader />
        <main id="main">
          <Plans billing={billing()} onBillingChange={setBilling} />
          <Comparison />
          <Faq items={PRICING_FAQ} title="Questions about plans and billing" />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

/* ───────────────────────── Plans (light) ───────────────────────── */

function Plans(props: {
  billing: Billing;
  onBillingChange: (b: Billing) => void;
}) {
  return (
    <section
      aria-labelledby="pricing-title"
      class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24"
    >
      <OnionRings class="absolute -top-64 -right-48 hidden w-[44rem] lg:block" />
      <div class={`${container} relative`}>
        <div class="mx-auto max-w-2xl text-center">
          <p class="font-display text-sm font-semibold tracking-wide text-primary uppercase">
            Pricing
          </p>
          <h1
            id="pricing-title"
            class="mt-3 font-display text-3xl font-semibold text-balance lg:text-4xl"
          >
            Start free. Pay when reviews start flowing.
          </h1>
          <p class="mt-5 text-lg text-pretty text-text-muted">
            One price per location, no setup fee, and no charge for your
            customers. Change or cancel whenever you like.
          </p>
        </div>

        <BillingToggle
          value={props.billing}
          onChange={props.onBillingChange}
          class="mt-10 flex justify-center"
        />

        <ul class="mt-10 grid gap-4 md:grid-cols-3 md:items-stretch">
          <For each={PLANS}>
            {(plan) => <PlanCard plan={plan} billing={props.billing} />}
          </For>
        </ul>

        <p class="mt-6 flex items-center justify-center gap-2 text-center text-sm text-text-muted">
          <IconShieldCheck
            aria-hidden="true"
            class="size-4 shrink-0 text-secondary"
          />
          Prices in INR per location, excluding GST. No card needed for Starter.
        </p>
      </div>
    </section>
  );
}

function PlanCard(props: { plan: Plan; billing: Billing }) {
  return (
    <li
      class={cn(
        "relative flex flex-col rounded-lg border bg-surface p-6",
        props.plan.featured
          ? "border-primary shadow-[0_12px_32px_rgb(91_33_182/0.14)] md:-my-2 md:py-8"
          : "border-border",
      )}
    >
      <div class="flex items-center justify-between gap-2">
        <h2
          id={`plan-${props.plan.id}`}
          class="font-display text-xl font-semibold"
        >
          {props.plan.name}
        </h2>
        <Show when={props.plan.featured}>
          <span class="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            Most popular
          </span>
        </Show>
      </div>
      <p class="mt-1 text-sm text-text-muted">{props.plan.tagline}</p>

      <PlanPrice plan={props.plan} billing={props.billing} />

      {/* A plain <a>: the router's <A> resolves `mailto:` as a relative path. */}
      <Dynamic
        component={PLAN_CTA[props.plan.id].href.startsWith("/") ? A : "a"}
        href={PLAN_CTA[props.plan.id].href}
        class={cn(
          props.plan.featured ? btnPrimary : btnSecondary,
          "mt-6 min-h-12 w-full",
        )}
      >
        {PLAN_CTA[props.plan.id].label}
        <span class="sr-only"> ({props.plan.name} plan)</span>
      </Dynamic>

      <FeatureList features={props.plan.features} />
    </li>
  );
}

/* ───────────────────────── Comparison (dark) ───────────────────────── */

function Comparison() {
  return (
    <section
      data-surface="dark"
      aria-labelledby="compare-title"
      class={`${section} bg-background text-text`}
    >
      <div class={container}>
        <SectionHeading
          id="compare-title"
          eyebrow="Compare plans"
          title="Every plan collects genuine reviews"
          lead="The honest-review flow is the same on every plan. Business adds volume and local search tools; Enterprise adds locations, tracking and room for a bigger team."
        />

        <section
          aria-labelledby="compare-title"
          tabindex="0"
          class="mt-10 overflow-x-auto rounded-lg border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table class="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption class="sr-only">
              Features included in the Starter, Business and Enterprise plans
            </caption>
            <thead>
              <tr class="border-b border-border">
                <th
                  scope="col"
                  class="w-2/5 px-4 py-4 font-medium text-text-muted"
                >
                  Feature
                </th>
                <For each={PLANS}>
                  {(plan) => (
                    <th
                      scope="col"
                      class="px-4 py-4 text-center font-display text-base font-semibold"
                    >
                      {plan.name}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <For each={COMPARISON}>
              {(group) => (
                <tbody>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={PLANS.length + 1}
                      class="bg-background px-4 pt-5 pb-2 font-display text-xs font-semibold tracking-wide text-primary uppercase"
                    >
                      {group.group}
                    </th>
                  </tr>
                  <For each={group.rows}>
                    {(row) => (
                      <tr class="h-11 border-b border-border last:border-b-0">
                        <th scope="row" class="px-4 py-3 font-normal">
                          {row.label}
                        </th>
                        <For each={PLANS}>
                          {(plan) => (
                            <td class="px-4 py-3 text-center">
                              <CellValue value={row.values[plan.id]} />
                            </td>
                          )}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              )}
            </For>
          </table>
        </section>
        <p class="mt-3 text-xs text-text-muted md:hidden">
          Scroll the table sideways to see every plan.
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA (accent band) ───────────────────────── */

function FinalCta() {
  return (
    <section
      data-surface="accent"
      aria-labelledby="cta-title"
      class="relative overflow-hidden bg-background py-16 text-text md:py-20"
    >
      <OnionRings class="absolute -top-40 -right-40 w-[36rem] text-[#FFFFFF24]" />
      <div
        class={`${container} relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between`}
      >
        <div>
          <h2
            id="cta-title"
            class="font-display text-2xl font-semibold text-balance md:text-3xl"
          >
            Print your first QR today, free.
          </h2>
          <p class="mt-2 text-text-muted">
            Upgrade only when you want more links, drafts or teammates.
          </p>
        </div>
        <A href="/signup" class={`${btnPrimary} min-h-12 shrink-0 px-6`}>
          <IconSparkles aria-hidden="true" class="size-5" />
          Start free
          <IconArrowRight aria-hidden="true" class="size-5" />
        </A>
      </div>
    </section>
  );
}
