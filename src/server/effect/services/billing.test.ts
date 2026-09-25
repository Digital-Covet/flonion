import type { BillingSubscription } from "@generated/prisma/client";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
import { PLANS } from "~/lib/plans";
import { fakeDb } from "../testing";
import { Billing } from "./billing";
import { Cashfree, CashfreeFailure } from "./cashfree";

type Handler = () => Promise<unknown>;

/** A Cashfree whose calls are answered by label; unknown labels fail loudly. */
function fakeCashfree(handlers: Record<string, Handler | Handler[]>) {
  const calls: string[] = [];
  const layer = Layer.succeed(
    Cashfree,
    Cashfree.of({
      call: <T>(label: string) =>
        Effect.suspend(() => {
          calls.push(label);
          const entry = handlers[label];
          const next = Array.isArray(entry) ? entry.shift() : entry;
          if (!next) return Effect.die(new Error(`unexpected call: ${label}`));
          return Effect.tryPromise({
            try: () => next() as Promise<T>,
            catch: (e) =>
              e instanceof CashfreeFailure
                ? e
                : new CashfreeFailure({ message: String(e) }),
          });
        }),
    }),
  );
  return { layer, calls };
}

const notFound = () =>
  Promise.reject(new CashfreeFailure({ message: "not found", status: 404 }));

function run<A, E>(
  program: (b: Billing["Service"]) => Effect.Effect<A, E>,
  cashfree: Layer.Layer<Cashfree>,
  db = fakeDb({}),
) {
  return Effect.runPromiseExit(
    Effect.gen(function* () {
      const billing = yield* Billing;
      return yield* program(billing);
    }).pipe(
      Effect.provide(
        Billing.layerWithoutDependencies.pipe(
          Layer.provide(Layer.mergeAll(cashfree, db)),
        ),
      ),
    ),
  );
}

const business = PLANS.find((p) => p.id === "business")!;
// business monthly: 999 + 18% GST
const matchingPlan = {
  plan_recurring_amount: 1178.82,
  plan_max_amount: 1178.82,
  plan_type: "PERIODIC",
};

describe("Billing.ensurePlan", () => {
  it("verifies an existing plan and remembers success", async () => {
    const cf = fakeCashfree({ "fetch plan": async () => matchingPlan });
    const exit = await run(
      (b) =>
        Effect.gen(function* () {
          yield* b.ensurePlan(business, "monthly");
          yield* b.ensurePlan(business, "monthly");
        }),
      cf.layer,
    );
    expect(exit._tag).toBe("Success");
    expect(cf.calls).toEqual(["fetch plan"]);
  });

  it("creates a missing plan", async () => {
    const cf = fakeCashfree({
      "fetch plan": notFound,
      "create plan": async () => ({}),
    });
    const exit = await run((b) => b.ensurePlan(business, "monthly"), cf.layer);
    expect(exit._tag).toBe("Success");
    expect(cf.calls).toEqual(["fetch plan", "create plan"]);
  });

  it("refuses a plan whose price differs, and does not cache the failure", async () => {
    const cf = fakeCashfree({
      "fetch plan": [
        async () => ({ ...matchingPlan, plan_max_amount: 5000 }),
        async () => matchingPlan,
      ],
    });
    const exit = await run(
      (b) =>
        Effect.gen(function* () {
          const first = yield* Effect.flip(b.ensurePlan(business, "monthly"));
          yield* b.ensurePlan(business, "monthly");
          return first;
        }),
      cf.layer,
    );
    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value._tag).toBe("BillingError");
    }
    expect(cf.calls).toEqual(["fetch plan", "fetch plan"]);
  });

  it("re-checks after a failed create (another instance won the race)", async () => {
    const cf = fakeCashfree({
      "fetch plan": [notFound, async () => matchingPlan],
      "create plan": () =>
        Promise.reject(new CashfreeFailure({ message: "exists", status: 409 })),
    });
    const exit = await run((b) => b.ensurePlan(business, "monthly"), cf.layer);
    expect(exit._tag).toBe("Success");
    expect(cf.calls).toEqual(["fetch plan", "create plan", "fetch plan"]);
  });
});

describe("Billing.sync", () => {
  const sub = {
    id: "row_1",
    subscriptionId: "flo_x",
    businessId: "biz_1",
    liveBusinessId: "biz_1",
    cfPlanId: "flonion_business_monthly_v1",
    planId: "business",
    billing: "monthly",
    amount: 1178.82,
    status: "INITIALIZED",
    cfSubscriptionId: null,
    cancelledAt: null,
  } as unknown as BillingSubscription;

  function db() {
    const businessUpdate = vi.fn(async () => ({}));
    const subUpdate = vi.fn(
      async (args: { data: Record<string, unknown> }) => ({
        ...sub,
        ...args.data,
      }),
    );
    const layer = fakeDb({
      $queryRaw: async () => [{ planExpiresAt: null }],
      billingPayment: { createMany: async () => ({ count: 1 }) },
      business: { update: businessUpdate },
      billingSubscription: { update: subUpdate },
    });
    return { layer, businessUpdate, subUpdate };
  }

  it("grants one period for an authorised mandate", async () => {
    const d = db();
    const cf = fakeCashfree({
      "fetch subscription": async () => ({
        subscription_status: "ACTIVE",
        cf_subscription_id: "cf_1",
        plan_details: { plan_id: sub.cfPlanId },
        authorisation_details: {
          authorization_status: "ACTIVE",
          authorization_amount_refund: false,
          authorization_amount: 1178.82,
          authorization_time: "2026-01-15T00:00:00Z",
        },
      }),
      "fetch subscription payments": async () => [],
    });
    const exit = await run((b) => b.sync(sub), cf.layer, d.layer);
    expect(exit._tag).toBe("Success");
    expect(d.businessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_1" },
      data: {
        plan: "business",
        planExpiresAt: new Date("2026-02-15T00:00:00Z"),
      },
    });
    expect(d.subUpdate.mock.calls[0][0].data).toMatchObject({
      status: "ACTIVE",
      liveBusinessId: "biz_1",
    });
  });

  it("cancels and retires a mandate for the wrong plan", async () => {
    const d = db();
    const cf = fakeCashfree({
      "fetch subscription": async () => ({
        subscription_status: "ACTIVE",
        plan_details: { plan_id: "someone_elses_plan" },
      }),
      "cancel mismatched subscription": async () => ({}),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = await run((b) => b.sync(sub), cf.layer, d.layer);
    log.mockRestore();
    expect(exit._tag).toBe("Success");
    expect(cf.calls).toContain("cancel mismatched subscription");
    expect(d.subUpdate.mock.calls[0][0].data).toEqual({
      status: "MISMATCH",
      liveBusinessId: null,
    });
    expect(d.businessUpdate).not.toHaveBeenCalled();
  });
});
