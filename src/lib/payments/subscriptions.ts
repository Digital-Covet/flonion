import { randomBytes } from "node:crypto";
import type { Billing, PlanId } from "~/lib/plans";

/*
 * The pure rules of billing. Everything that talks to Cashfree or the
 * database is the `Billing` service in `src/server/effect/services/billing.ts`.
 */

/** Our own statuses, alongside Cashfree's subscription_status values. */
export const ABANDONED = "ABANDONED";
export const MISMATCH = "MISMATCH";

/**
 * Statuses after which Cashfree will never charge the mandate again. Anything
 * else, including a status we don't recognise, is treated as live, so the
 * business can't open a second mandate next to one that may still charge.
 */
const TERMINAL_STATUSES = new Set([
  "CANCELLED",
  "CUSTOMER_CANCELLED",
  "EXPIRED",
  "COMPLETED",
  "LINK_EXPIRED",
  "CARD_EXPIRED",
  "FAILED",
  ABANDONED,
  MISMATCH,
]);

export function isLiveStatus(status: string): boolean {
  return !TERMINAL_STATUSES.has(status);
}

/** Still waiting for the customer to finish checkout. */
export const PENDING_STATUSES = new Set(["INITIALIZED", "INITIALISED"]);

/** Checkout links expire before we give up on them (see `abandonIfStale`). */
export const CHECKOUT_SESSION_MS = 20 * 60 * 1000;
export const ABANDON_AFTER_MS = 30 * 60 * 1000;

/**
 * Versioned so a price change creates a new Cashfree plan instead of
 * silently changing what existing mandates are charged.
 */
export function cashfreePlanId(planId: PlanId, billing: Billing): string {
  return `flonion_${planId}_${billing}_v1`;
}

export function addPeriod(from: Date, billing: Billing): Date {
  const d = new Date(from);
  if (billing === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function newSubscriptionId(): string {
  return `flo_${randomBytes(16).toString("hex")}`;
}

export function toDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function sameAmount(a: number | undefined, b: number): boolean {
  return typeof a === "number" && Math.abs(a - b) < 0.005;
}
