import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import {
  IconCircleCheck,
  IconLock,
  IconRocket,
  IconShieldCheck,
} from "@tabler/icons-solidjs";
import { createSignal, For, onMount, Show } from "solid-js";
import { type BusinessInfo, useApp } from "~/components/app/context";
import { inputBase, labelClass } from "~/components/auth/AuthShell";
import {
  btnPrimary,
  btnSecondary,
  btnSecondarySm,
} from "~/components/landing/SiteHeader";
import { Notice } from "~/components/onboarding/ui";
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
  chargeFor,
  isUpgrade,
  PLANS,
  type Plan,
  type PlanId,
} from "~/lib/plans";

const CHECKOUT_MODE =
  import.meta.env.VITE_CASHFREE_MODE === "production"
    ? "production"
    : "sandbox";

/** Same rule as the subscribe API, so most mistakes never leave the page. */
const PHONE_RE = /^[6-9]\d{9}$/;
const normalizePhone = (value: string) =>
  value.replace(/[\s()-]/g, "").replace(/^(\+91|0091|0)/, "");

const rupees = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const longDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

/**
 * Enterprise is quoted, so it stays a pre-filled email to the team. RFC 6068
 * wants CRLF line breaks in a mailto body.
 */
function planRequestHref(plan: Plan, business: BusinessInfo | undefined) {
  const name = business?.businessName || "my business";
  const subject = `${plan.name} plan enquiry`;
  const body = [
    "Hi Flonion team,",
    "",
    `I'd like to talk about the ${plan.name} plan for ${name}.`,
    "",
    `Business: ${name}`,
    `Business ID: ${business?.businessId ?? "unknown"}`,
  ].join("\r\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type ReturnState = "checking" | "success" | "pending" | "failed";

const PENDING = new Set([
  "INITIALIZED",
  "INITIALISED",
  "BANK_APPROVAL_PENDING",
]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * In-app plan picker, reached from the sidebar's upgrade link. It reuses the
 * public `/pricing` data so both pages quote the same limits, but sits in the
 * app shell at app density: the owner's current plan is marked, and paid
 * plans open Cashfree's hosted subscription checkout.
 */
export default function UpgradePage() {
  const { business, refetchBusiness } = useApp();
  const [params, setParams] = useSearchParams();
  const [billing, setBilling] = createSignal<Billing>("monthly");
  const [returned, setReturned] = createSignal<ReturnState | null>(null);

  // `.latest` so the page renders while the shell's business revalidates.
  const b = () => business.latest;
  const current = (): PlanId => b()?.plan ?? "starter";
  const currentPlan = () => PLANS.find((p) => p.id === current()) ?? PLANS[0];
  // Mirrors `canManageTeam`: owners and admins change the plan. Treat "not
  // loaded yet" as allowed so the CTAs don't flash disabled on first paint.
  const canChange = () => {
    const info = b();
    return !info || info.isOwner || info.role === "admin";
  };

  // Cashfree sends the customer back here. Confirm with our server (which
  // asks Cashfree) rather than trusting the redirect itself.
  onMount(async () => {
    const raw = params.subscription_id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) return;
    setReturned("checking");

    let state: ReturnState = "pending";
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(
          `/api/billing/status?subscription_id=${encodeURIComponent(id)}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
        };
        if (!res.ok) {
          state = "failed";
          break;
        }
        if (data.status === "ACTIVE") {
          state = "success";
          break;
        }
        state = data.status && PENDING.has(data.status) ? "pending" : "failed";
        if (state === "failed") break;
      } catch {
        state = "pending";
      }
      await sleep(2500);
    }

    setReturned(state);
    setParams({ subscription_id: undefined }, { replace: true, scroll: false });
    await refetchBusiness();
  });

  return (
    <>
      <Title>Upgrade · Flonion</Title>

      <div class="flex flex-col gap-8">
        <header class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Upgrade your plan
            </h1>
            <p class="mt-1 max-w-[62ch] text-base text-pretty text-text-muted">
              <Show when={b()?.businessName} fallback="Your business">
                {(name) => <span class="font-medium text-text">{name()}</span>}
              </Show>{" "}
              is on{" "}
              <span class="font-medium text-text">{currentPlan().name}</span>.
              <Show when={current() === "starter"}>
                {" "}
                Upgrade for unlimited review links, more AI drafts and local SEO
                tools.
              </Show>
            </p>
          </div>
          <BillingToggle
            value={billing()}
            onChange={setBilling}
            class="shrink-0"
          />
        </header>

        <Show when={returned()}>
          {(state) => <ReturnNotice state={state()} />}
        </Show>

        <Show when={!canChange()}>
          <Notice tone="info">
            Only the business owner or an admin can change the plan. You can
            still compare plans here and share them with your owner.
          </Notice>
        </Show>

        <section aria-labelledby="plans-title">
          <h2 id="plans-title" class="sr-only">
            Plans
          </h2>
          <ul class="grid gap-4 md:grid-cols-3 md:items-stretch">
            <For each={PLANS}>
              {(plan) => (
                <PlanCard
                  plan={plan}
                  billing={billing()}
                  current={current()}
                  business={b()}
                  canChange={canChange()}
                  onChanged={refetchBusiness}
                />
              )}
            </For>
          </ul>

          <div class="mt-4 flex flex-col gap-2 text-sm text-text-muted">
            <p class="flex items-start gap-2">
              <IconLock
                aria-hidden="true"
                class="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>
                Payments are handled by Cashfree. You approve a UPI Autopay,
                card or netbanking mandate on Cashfree's secure page, and we
                never see your card or bank details. You can cancel auto-renew
                here at any time.
              </span>
            </p>
            <p class="flex items-start gap-2">
              <IconShieldCheck
                aria-hidden="true"
                class="mt-0.5 size-4 shrink-0 text-secondary"
              />
              <span>
                Prices in INR per location; 18% GST is added at checkout. Your
                reviews and QR codes stay if you ever move back to Starter.
              </span>
            </p>
          </div>
        </section>

        <Comparison current={current()} />
      </div>
    </>
  );
}

function ReturnNotice(props: { state: ReturnState }) {
  const tone = () =>
    props.state === "success"
      ? "success"
      : props.state === "failed"
        ? "error"
        : "info";
  const message = () => {
    switch (props.state) {
      case "checking":
        return "Confirming your payment with Cashfree…";
      case "success":
        return "Payment received. Your new plan is active.";
      case "pending":
        return "Cashfree is still confirming your mandate. This can take a few minutes, or longer for a bank mandate. Your plan switches on as soon as it's approved.";
      default:
        return "The payment didn't go through, so you haven't been charged for a new plan. You can try again.";
    }
  };
  return <Notice tone={tone()}>{message()}</Notice>;
}

/** "₹999.00 + ₹179.82 GST = ₹1,178.82 a month, auto-renews" */
function GstLine(props: { plan: Plan; billing: Billing }) {
  const charge = () => chargeFor(props.plan, props.billing);
  return (
    <Show when={charge()}>
      {(c) => (
        <p class="mt-2 text-xs text-text-muted">
          <span class="font-mono tabular-nums">₹{rupees.format(c().base)}</span>{" "}
          +{" "}
          <span class="font-mono tabular-nums">₹{rupees.format(c().gst)}</span>{" "}
          GST ={" "}
          <span class="font-mono font-medium text-text tabular-nums">
            ₹{rupees.format(c().total)}
          </span>{" "}
          {props.billing === "yearly" ? "a year" : "a month"}, auto-renews
        </p>
      )}
    </Show>
  );
}

function PlanCard(props: {
  plan: Plan;
  billing: Billing;
  current: PlanId;
  business: BusinessInfo | undefined;
  canChange: boolean;
  onChanged: () => Promise<void>;
}) {
  const isCurrent = () => props.plan.id === props.current;
  // Only plans above the current one are an upgrade; nothing to sell below it.
  const upgradable = () => isUpgrade(props.current, props.plan.id);
  const payable = () => chargeFor(props.plan, props.billing) !== null;
  const label = () =>
    payable() ? `Upgrade to ${props.plan.name}` : "Talk to us";

  return (
    <li
      aria-labelledby={`upgrade-plan-${props.plan.id}`}
      class={cn(
        "relative flex flex-col rounded-lg border bg-surface p-5 md:p-6",
        // Stacked on a phone, the plan they already have would fill the first
        // screen; lead with what they can move to instead.
        isCurrent() && "order-last md:order-none",
        props.plan.featured && !isCurrent()
          ? "border-primary shadow-[0_12px_32px_rgb(91_33_182/0.14)]"
          : "border-border",
      )}
    >
      <div class="flex items-center justify-between gap-2">
        <h3
          id={`upgrade-plan-${props.plan.id}`}
          class="font-display text-lg font-semibold"
        >
          {props.plan.name}
        </h3>
        <Show
          when={isCurrent()}
          fallback={
            <Show when={props.plan.featured}>
              <span class="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                Recommended
              </span>
            </Show>
          }
        >
          <span class="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
            <IconCircleCheck aria-hidden="true" class="size-3.5" />
            Current plan
          </span>
        </Show>
      </div>
      <p class="mt-1 text-sm text-text-muted">{props.plan.tagline}</p>

      <PlanPrice plan={props.plan} billing={props.billing} />
      <Show when={upgradable()}>
        <GstLine plan={props.plan} billing={props.billing} />
      </Show>

      <div class="mt-6">
        <Show
          when={upgradable()}
          fallback={
            <Show
              when={isCurrent() && props.current !== "starter"}
              fallback={
                <p class="flex min-h-12 items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-4 text-sm font-medium text-text-muted">
                  <Show when={isCurrent()} fallback="Included in your plan">
                    You're on this plan
                  </Show>
                </p>
              }
            >
              <CurrentPaidPlan
                business={props.business}
                canChange={props.canChange}
                onChanged={props.onChanged}
              />
            </Show>
          }
        >
          <Show
            when={props.canChange}
            fallback={
              <button
                type="button"
                disabled
                class={cn(
                  props.plan.featured ? btnPrimary : btnSecondary,
                  "min-h-12 w-full cursor-not-allowed opacity-60",
                )}
              >
                {label()}
                <span class="sr-only">
                  {" "}
                  (only the owner or an admin can change the plan)
                </span>
              </button>
            }
          >
            <Show
              when={payable()}
              fallback={
                <a
                  href={planRequestHref(props.plan, props.business)}
                  rel="external"
                  class={cn(
                    props.plan.featured ? btnPrimary : btnSecondary,
                    "min-h-12 w-full",
                  )}
                >
                  {label()}
                  <span class="sr-only">
                    {" "}
                    ({props.plan.name} plan, opens an email)
                  </span>
                </a>
              }
            >
              <CheckoutButton
                plan={props.plan}
                billing={props.billing}
                label={label()}
                business={props.business}
              />
            </Show>
          </Show>
        </Show>
      </div>

      <FeatureList features={props.plan.features} />
    </li>
  );
}

/**
 * Starts Cashfree's hosted subscription checkout. The server works out the
 * amount; this only says which plan and billing period. It asks for a mobile
 * number only when the business profile has none, since Cashfree requires one.
 */
function CheckoutButton(props: {
  plan: Plan;
  billing: Billing;
  label: string;
  business: BusinessInfo | undefined;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [phone, setPhone] = createSignal("");
  const [askPhone, setAskPhone] = createSignal(false);
  let phoneInput: HTMLInputElement | undefined;

  const needsPhone = () => askPhone() || !props.business?.phone;
  const phoneId = () => `upgrade-phone-${props.plan.id}`;
  const errorId = () => `upgrade-error-${props.plan.id}`;

  async function start() {
    if (busy()) return;
    setError(null);

    const normalized = normalizePhone(phone());
    if (needsPhone() && !PHONE_RE.test(normalized)) {
      setError("Enter a 10-digit mobile number for payment alerts.");
      phoneInput?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: props.plan.id,
          billing: props.billing,
          phone: needsPhone() ? normalized : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        subsSessionId?: string;
        error?: string;
        field?: string;
      };
      if (!res.ok || !data.subsSessionId) {
        if (data.field === "phone") setAskPhone(true);
        setError(data.error ?? "Couldn't start checkout. Please try again.");
        return;
      }

      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({ mode: CHECKOUT_MODE });
      if (!cashfree) throw new Error("Cashfree.js did not load");

      // `_self` navigates away; Cashfree returns to /upgrade?subscription_id=…
      const result = await cashfree.subscriptionsCheckout({
        subsSessionId: data.subsSessionId,
        redirectTarget: "_self",
      });
      if (result?.error) {
        setError(result.error.message ?? "Checkout couldn't open.");
      }
    } catch {
      setError("Couldn't open checkout. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex flex-col gap-3">
      <Show when={needsPhone()}>
        <div class="flex flex-col gap-1.5">
          <label for={phoneId()} class={labelClass}>
            Mobile number
          </label>
          <input
            ref={phoneInput}
            id={phoneId()}
            type="tel"
            inputmode="numeric"
            autocomplete="tel-national"
            maxlength={14}
            placeholder="98765 43210"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
            aria-invalid={error() ? true : undefined}
            aria-describedby={error() ? errorId() : undefined}
            class={inputBase}
          />
          <p class="text-xs text-text-muted">
            Cashfree sends mandate and payment alerts here. We also save it to
            your business profile.
          </p>
        </div>
      </Show>
      <button
        type="button"
        onClick={start}
        disabled={busy()}
        aria-describedby={error() ? errorId() : undefined}
        class={cn(
          props.plan.featured ? btnPrimary : btnSecondary,
          "min-h-12 w-full disabled:cursor-progress disabled:opacity-80",
        )}
      >
        <Show when={props.plan.featured}>
          <IconRocket aria-hidden="true" class="size-5" />
        </Show>
        {busy() ? "Opening checkout…" : props.label}
      </button>
      <Show when={error()}>
        {(message) => (
          <p id={errorId()} role="alert" class="text-sm text-error">
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}

/** Renewal date, plus cancel auto-renew, for the plan the business pays for. */
function CurrentPaidPlan(props: {
  business: BusinessInfo | undefined;
  canChange: boolean;
  onChanged: () => Promise<void>;
}) {
  const [confirming, setConfirming] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const until = () => {
    const iso = props.business?.planExpiresAt;
    return iso ? longDate.format(new Date(iso)) : null;
  };
  const renews = () => props.business?.subscription?.renews ?? false;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't cancel right now. Please try again.");
        return;
      }
      setConfirming(false);
      await props.onChanged();
    } catch {
      setError("Couldn't cancel right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex flex-col gap-3 rounded-md border border-dashed border-border-strong p-4 text-sm">
      <p class="font-medium text-text">
        <Show
          when={renews()}
          fallback={<>Active until {until() ?? "the end of this period"}</>}
        >
          Renews on {until() ?? "the next billing date"}
        </Show>
      </p>
      <Show when={renews() && props.canChange}>
        <Show
          when={confirming()}
          fallback={
            <button
              type="button"
              onClick={() => setConfirming(true)}
              class={cn(btnSecondarySm, "self-start")}
            >
              Cancel auto-renew
            </button>
          }
        >
          <p class="text-text-muted">
            Stop future charges? You keep this plan until{" "}
            {until() ?? "the end of the paid period"}.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={busy()}
              class={cn(btnSecondarySm, "disabled:opacity-70")}
            >
              {busy() ? "Cancelling…" : "Yes, cancel auto-renew"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy()}
              class={btnSecondarySm}
            >
              Keep it
            </button>
          </div>
        </Show>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class="text-error">
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}

function Comparison(props: { current: PlanId }) {
  return (
    <section
      aria-labelledby="upgrade-compare-title"
      class="flex flex-col gap-3"
    >
      <div>
        <h2
          id="upgrade-compare-title"
          class="font-display text-lg font-semibold text-text"
        >
          Compare plans
        </h2>
        <p class="mt-1 text-sm text-text-muted">
          The honest-review flow is the same on every plan. Business adds volume
          and local search tools.
        </p>
      </div>

      {/* Focusable so keyboard users can scroll it sideways on a phone. */}
      <section
        aria-label="Plan comparison table"
        tabindex="0"
        class="overflow-x-auto rounded-lg border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <table class="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption class="sr-only">
            Features included in the Starter, Business and Enterprise plans
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th
                scope="col"
                class="w-2/5 px-4 py-3 font-medium text-text-muted"
              >
                Feature
              </th>
              <For each={PLANS}>
                {(plan) => (
                  <th
                    scope="col"
                    class={cn(
                      "px-4 py-3 text-center font-display text-base font-semibold",
                      plan.id === props.current && "bg-primary-soft/50",
                    )}
                  >
                    {plan.name}
                    <Show when={plan.id === props.current}>
                      <span class="block font-sans text-xs font-medium text-text-muted">
                        Current
                      </span>
                    </Show>
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
                    class="bg-background px-4 pt-4 pb-2 font-display text-xs font-semibold tracking-wide text-primary uppercase"
                  >
                    {group.group}
                  </th>
                </tr>
                <For each={group.rows}>
                  {(row) => (
                    <tr class="h-11 border-b border-border last:border-b-0">
                      <th scope="row" class="px-4 py-2.5 font-normal">
                        {row.label}
                      </th>
                      <For each={PLANS}>
                        {(plan) => (
                          <td
                            class={cn(
                              "px-4 py-2.5 text-center",
                              plan.id === props.current && "bg-primary-soft/50",
                            )}
                          >
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
      <p class="text-xs text-text-muted md:hidden">
        Scroll the table sideways to see every plan.
      </p>
    </section>
  );
}
