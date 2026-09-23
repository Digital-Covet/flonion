export type Billing = "monthly" | "yearly";
export type PlanId = "starter" | "business" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Per month; `yearly` is the per-month equivalent. Null means quoted. */
  price: { monthly: number; yearly: number } | null;
  featured?: boolean;
  features: string[];
};

/*
 * Prices are in INR, per business location, excluding GST (see `chargeFor`).
 * Changing a price needs a new Cashfree plan id in `src/lib/payments`. Yearly is shown
 * as the per-month equivalent. Enterprise is quoted, so it has no price.
 * Shared by the public `/pricing` page and the in-app `/upgrade` page so the
 * two can never quote different numbers.
 */
export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Try it on your counter",
    price: { monthly: 0, yearly: 0 },
    features: [
      "1 review link with printable QR",
      "Review inbox for Google reviews",
      "25 AI drafts a month",
      "1 team member",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For a busy location and its team",
    price: { monthly: 999, yearly: 799 },
    featured: true,
    features: [
      "Unlimited review links and QR codes",
      "500 AI drafts a month",
      "Local SEO score and weekly actions",
      "Campaign analytics",
      "Booking page and meeting scheduler",
      "Up to 10 team members",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For chains, franchises and multi-location brands",
    price: null,
    features: [
      "Everything in Business",
      "Multiple locations in one account",
      "Custom AI draft volume",
      "Keyword and competitor tracking",
      "Task board with team workload",
      "Unlimited team members",
      "Dedicated onboarding and priority support",
    ],
  },
];

export const PLAN_IDS = PLANS.map((p) => p.id);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function isBilling(value: unknown): value is Billing {
  return value === "monthly" || value === "yearly";
}

/** Only plans above the current one are an upgrade. */
export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return PLAN_IDS.indexOf(to) > PLAN_IDS.indexOf(from);
}

export const GST_RATE = 0.18;

/** Rounds to paise without binary-float drift (1.005 → 1.01). */
function paise(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * What one billing period actually costs, GST included. The server computes
 * the Cashfree charge from this and never takes an amount from the client.
 * Null for a plan with no online price (Starter is free, Enterprise quoted).
 */
export function chargeFor(
  plan: Plan,
  billing: Billing,
): { base: number; gst: number; total: number } | null {
  if (!plan.price || plan.price.monthly === 0) return null;
  const base =
    billing === "yearly" ? plan.price.yearly * 12 : plan.price.monthly;
  const gst = paise(base * GST_RATE);
  return { base, gst, total: paise(base + gst) };
}

/**
 * Cashfree retries a failed renewal over a few days. Keep the paid plan
 * through that window so a retry that succeeds doesn't bounce the business
 * to Starter and back.
 */
export const PLAN_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The plan a business is on right now. A lapsed paid period falls back to
 * Starter here, so no job has to downgrade anyone.
 */
export function effectivePlan(
  business: { plan: string; planExpiresAt: Date | null },
  now = Date.now(),
): PlanId {
  if (!isPlanId(business.plan) || business.plan === "starter") {
    return "starter";
  }
  if (!business.planExpiresAt) return "starter";
  return business.planExpiresAt.getTime() + PLAN_GRACE_MS > now
    ? business.plan
    : "starter";
}

export function planName(id: PlanId): string {
  return PLANS.find((p) => p.id === id)?.name ?? "Starter";
}

export type Cell = boolean | string;

export const COMPARISON: {
  group: string;
  rows: { label: string; values: Record<PlanId, Cell> }[];
}[] = [
  {
    group: "Collect reviews",
    rows: [
      {
        label: "Review links with QR",
        values: {
          starter: "1",
          business: "Unlimited",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Printable QR sheet",
        values: { starter: true, business: true, enterprise: true },
      },
      {
        label: "AI writing help for customers",
        values: { starter: true, business: true, enterprise: true },
      },
      {
        label: "Review platforms (Google, JustDial and more)",
        values: { starter: true, business: true, enterprise: true },
      },
    ],
  },
  {
    group: "Reply",
    rows: [
      {
        label: "Review inbox with sentiment",
        values: { starter: true, business: true, enterprise: true },
      },
      {
        label: "AI drafts per month",
        values: { starter: "25", business: "500", enterprise: "Custom" },
      },
      {
        label: "Reply tones (Professional, Friendly, Formal)",
        values: { starter: true, business: true, enterprise: true },
      },
    ],
  },
  {
    group: "Get found",
    rows: [
      {
        label: "Profile score and actions",
        values: { starter: false, business: true, enterprise: true },
      },
      {
        label: "Campaign analytics",
        values: { starter: false, business: true, enterprise: true },
      },
      {
        label: "Keyword tracking",
        values: { starter: false, business: false, enterprise: true },
      },
      {
        label: "Competitor comparison",
        values: { starter: false, business: false, enterprise: true },
      },
    ],
  },
  {
    group: "Team and partners",
    rows: [
      {
        label: "Locations",
        values: { starter: "1", business: "1", enterprise: "Multiple" },
      },
      {
        label: "Team members",
        values: { starter: "1", business: "10", enterprise: "Unlimited" },
      },
      {
        label: "Booking page and scheduler",
        values: { starter: false, business: true, enterprise: true },
      },
      {
        label: "Task board and workload",
        values: { starter: false, business: false, enterprise: true },
      },
      {
        label: "Partner marketplace listing",
        values: { starter: true, business: true, enterprise: true },
      },
      {
        label: "Support",
        values: { starter: "Email", business: "Email", enterprise: "Priority" },
      },
    ],
  },
];

export const inr = new Intl.NumberFormat("en-IN");
