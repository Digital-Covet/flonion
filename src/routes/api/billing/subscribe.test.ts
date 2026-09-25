import { Prisma } from "@generated/prisma/client";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeBilling, fakeDb, fakeEvent, fakeSession, useRuntime } =
  await import("~/server/effect/testing");
const { CashfreeFailure } = await import("~/server/effect/services/cashfree");
const { POST } = await import("./subscribe");

let n = 0;

function setup(
  opts: {
    plan?: string;
    phone?: string | null;
    existing?: object | null;
    ensureFails?: boolean;
    createFails?: boolean;
    duplicate?: boolean;
  } = {},
) {
  const businessId = `biz_sub_${++n}`;
  const {
    plan = "starter",
    phone = "9876543210",
    existing = null,
    ensureFails = false,
    createFails = false,
    duplicate = false,
  } = opts;
  const subUpdate = vi.fn(async () => ({}));
  const businessUpdate = vi.fn(async () => ({}));
  const create = vi.fn(async (args: { data: object }) => {
    if (duplicate) {
      throw new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      });
    }
    return { id: "row_1", ...args.data };
  });
  useRuntime({
    auth: fakeAuth(fakeSession()),
    db: fakeDb({
      user: {
        findUnique: async (args: { select: Record<string, unknown> }) =>
          "role" in args.select
            ? {
                businessId,
                role: "owner",
                business: { id: businessId },
              }
            : { name: "Asha", email: "asha@example.com" },
      },
      business: {
        findUnique: async () => ({
          plan,
          // A paid plan only counts while its period is paid for.
          planExpiresAt: new Date(Date.now() + 86_400_000),
          phone,
        }),
        update: businessUpdate,
      },
      billingSubscription: {
        findUnique: async () => existing,
        create,
        update: subUpdate,
      },
    }),
    billing: fakeBilling({
      ensurePlan: () =>
        ensureFails
          ? Effect.fail(new CashfreeFailure({ message: "down" }))
          : Effect.void,
      createSubscription: () =>
        createFails
          ? Effect.fail(new CashfreeFailure({ message: "down" }))
          : Effect.succeed("session_123"),
      abandonIfStale: (sub) => Effect.succeed(sub),
    }),
  });
  return { subUpdate, businessUpdate, create };
}

async function call(body: unknown) {
  const res = await POST(fakeEvent({ body }));
  return { status: res.status, body: await res.json() };
}

const valid = { planId: "business", billing: "monthly" };

describe("POST /api/billing/subscribe", () => {
  it("rejects unknown plans and unpriced ones", async () => {
    setup();
    expect(await call({ planId: "gold", billing: "monthly" })).toEqual({
      status: 400,
      body: { error: "Invalid plan" },
    });
    expect(await call({ planId: "enterprise", billing: "monthly" })).toEqual({
      status: 400,
      body: { error: "That plan can't be bought online" },
    });
  });

  it("409s when the business is already on the plan", async () => {
    setup({ plan: "business" });
    expect(await call(valid)).toEqual({
      status: 409,
      body: { error: "Your business is already on this plan or higher" },
    });
  });

  it("409s while another mandate is live", async () => {
    setup({ existing: { liveBusinessId: "x", status: "ACTIVE" } });
    expect((await call(valid)).status).toBe(409);
  });

  it("asks for a phone number with the field name", async () => {
    setup({ phone: null });
    expect(await call(valid)).toEqual({
      status: 400,
      body: { error: "Enter a 10-digit Indian mobile number", field: "phone" },
    });
  });

  it("502s when the plan can't be ensured", async () => {
    setup({ ensureFails: true });
    expect(await call(valid)).toEqual({
      status: 502,
      body: {
        error: "Payments are unavailable right now. Please try again later.",
      },
    });
  });

  it("409s a concurrent duplicate insert", async () => {
    setup({ duplicate: true });
    expect(await call(valid)).toEqual({
      status: 409,
      body: {
        error: "A subscription is already in progress for this business.",
      },
    });
  });

  it("frees the slot and 502s when Cashfree refuses the mandate", async () => {
    const { subUpdate } = setup({ createFails: true });
    expect(await call(valid)).toEqual({
      status: 502,
      body: { error: "Couldn't start checkout. Please try again." },
    });
    expect(subUpdate).toHaveBeenCalledWith({
      where: { id: "row_1" },
      data: { status: "FAILED", liveBusinessId: null },
    });
  });

  it("returns the checkout session and saves a new phone", async () => {
    const { businessUpdate } = setup({ phone: null });
    const res = await call({ ...valid, phone: "+91 98765 43210" });
    expect(res.status).toBe(201);
    expect(res.body.subsSessionId).toBe("session_123");
    expect(res.body.subscriptionId).toMatch(/^flo_[a-f0-9]{32}$/);
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: { phone: "9876543210" },
    });
  });
});
