import { createHmac } from "node:crypto";
import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeBilling, fakeDb, useRuntime } = await import(
  "~/server/effect/testing"
);
const { CashfreeFailure } = await import("~/server/effect/services/cashfree");
const { POST } = await import("./cashfree");

const SECRET = "whsec";

function signedEvent(body: string, opts: { badSignature?: boolean } = {}) {
  const ts = String(Date.now());
  const sig = createHmac("sha256", opts.badSignature ? "wrong" : SECRET)
    .update(ts + body)
    .digest("base64");
  const request = new Request("http://localhost/api/webhooks/cashfree", {
    method: "POST",
    body,
    headers: { "x-webhook-signature": sig, "x-webhook-timestamp": ts },
  });
  return { request, params: {}, locals: {} } as never;
}

const statusEvent = JSON.stringify({
  type: "SUBSCRIPTION_STATUS_CHANGED",
  data: { subscription_details: { subscription_id: "flo_1" } },
});

function setup(opts: { known?: boolean; syncFails?: boolean } = {}) {
  const { known = true, syncFails = false } = opts;
  const sync = vi.fn((sub) =>
    syncFails
      ? Effect.fail(new CashfreeFailure({ message: "down" }))
      : Effect.succeed(sub),
  );
  useRuntime({
    db: fakeDb({
      billingSubscription: {
        findUnique: async () => (known ? { id: "row_1" } : null),
      },
    }),
    billing: fakeBilling({ sync }),
  });
  return { sync };
}

describe("POST /api/webhooks/cashfree", () => {
  beforeAll(() => {
    process.env.CASHFREE_WEBHOOK_SECRET = SECRET;
  });
  afterAll(() => {
    delete process.env.CASHFREE_WEBHOOK_SECRET;
  });

  it("syncs a verified subscription event", async () => {
    const { sync } = setup();
    const res = await POST(signedEvent(statusEvent));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(sync).toHaveBeenCalledOnce();
  });

  it("401s a bad signature without touching anything", async () => {
    const { sync } = setup();
    const res = await POST(signedEvent(statusEvent, { badSignature: true }));
    expect(res.status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("400s a signed body that is not JSON", async () => {
    setup();
    expect((await POST(signedEvent("{"))).status).toBe(400);
  });

  it("413s an oversized body", async () => {
    setup();
    const res = await POST(signedEvent("x".repeat(64 * 1024 + 1)));
    expect(res.status).toBe(413);
  });

  it("acknowledges other events and unknown subscriptions", async () => {
    const { sync } = setup({ known: false });
    expect(
      (await POST(signedEvent(JSON.stringify({ type: "PAYMENT_X" })))).status,
    ).toBe(200);
    expect((await POST(signedEvent(statusEvent))).status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it("503s when the sync fails, so Cashfree retries", async () => {
    setup({ syncFails: true });
    const res = await POST(signedEvent(statusEvent));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("");
  });
});
