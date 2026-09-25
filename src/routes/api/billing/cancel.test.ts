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
const { POST } = await import("./cancel");

let n = 0;
function setup(opts: {
  signedIn?: boolean;
  role?: string;
  owner?: boolean;
  hasBusiness?: boolean;
  sub?: object | null;
  cancel?: "ok" | "fail";
}) {
  const businessId = `biz_${++n}`;
  const {
    signedIn = true,
    role = "member",
    owner = true,
    hasBusiness = true,
    sub = { id: "sub_row", subscriptionId: "cf_sub" },
    cancel = "ok",
  } = opts;
  useRuntime({
    auth: fakeAuth(signedIn ? fakeSession() : null),
    db: fakeDb({
      user: {
        findUnique: async () => ({
          businessId: hasBusiness ? businessId : null,
          role,
          business: hasBusiness && owner ? { id: businessId } : null,
        }),
      },
      billingSubscription: { findUnique: async () => sub },
    }),
    billing: fakeBilling({
      cancel: (s) =>
        cancel === "ok"
          ? Effect.succeed({ ...s, status: "CANCELLED" })
          : Effect.fail(new CashfreeFailure({ message: "upstream down" })),
    }),
  });
}

async function call() {
  const res = await POST(fakeEvent());
  return { status: res.status, body: await res.json() };
}

describe("POST /api/billing/cancel", () => {
  it("401s when signed out", async () => {
    setup({ signedIn: false });
    expect(await call()).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("404s without a business", async () => {
    setup({ hasBusiness: false });
    expect(await call()).toEqual({
      status: 404,
      body: { error: "No business found" },
    });
  });

  it("403s a plain member", async () => {
    setup({ owner: false, role: "member" });
    expect(await call()).toEqual({
      status: 403,
      body: {
        error: "Only the business owner or an admin can change the plan",
      },
    });
  });

  it("404s when there is nothing to cancel", async () => {
    setup({ sub: null });
    expect(await call()).toEqual({
      status: 404,
      body: { error: "There's no active subscription to cancel" },
    });
  });

  it("cancels and returns the new status", async () => {
    setup({ owner: false, role: "admin" });
    expect(await call()).toEqual({
      status: 200,
      body: { status: "CANCELLED" },
    });
  });

  it("502s when Cashfree fails", async () => {
    setup({ cancel: "fail" });
    expect(await call()).toEqual({
      status: 502,
      body: { error: "Couldn't cancel right now. Please try again." },
    });
  });

  it("429s after five attempts in an hour", async () => {
    setup({});
    for (let i = 0; i < 5; i++) expect((await call()).status).toBe(200);
    expect(await call()).toEqual({
      status: 429,
      body: { error: "Too many attempts. Please try again later." },
    });
  });
});
