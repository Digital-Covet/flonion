import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeBilling, fakeDb, fakeEvent, fakeSession, useRuntime } =
  await import("~/server/effect/testing");
const { GET } = await import("./status");

const SUB_ID = `flo_${"a".repeat(32)}`;

let n = 0;
function setup(opts: { sub?: object | null } = {}) {
  const businessId = `biz_${++n}`;
  const { sub = { id: "sub_row", subscriptionId: SUB_ID } } = opts;
  const lookups: unknown[] = [];
  useRuntime({
    auth: fakeAuth(fakeSession()),
    db: fakeDb({
      user: {
        findUnique: async () => ({
          businessId,
          role: "member",
          business: { id: businessId },
        }),
      },
      billingSubscription: {
        findFirst: async (args: { where: unknown }) => {
          lookups.push(args.where);
          return sub;
        },
      },
      business: {
        findUnique: async () => ({
          plan: "business",
          planExpiresAt: new Date(Date.now() + 86_400_000),
        }),
      },
    }),
    billing: fakeBilling({
      sync: (s) => Effect.succeed({ ...s, status: "ACTIVE" }),
    }),
  });
  return { businessId, lookups };
}

async function call(query = "") {
  const res = await GET(
    fakeEvent({
      method: "GET",
      url: `http://localhost/api/billing/status${query}`,
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe("GET /api/billing/status", () => {
  it("syncs the named subscription, scoped to the caller's business", async () => {
    const { businessId, lookups } = setup();
    const { status, body } = await call(`?subscription_id=${SUB_ID}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ACTIVE", plan: "business" });
    expect(lookups).toEqual([{ subscriptionId: SUB_ID, businessId }]);
  });

  it("without an id, syncs the business's live subscription", async () => {
    const { businessId, lookups } = setup();
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ACTIVE", plan: "business" });
    expect(lookups).toEqual([{ liveBusinessId: businessId }]);
  });

  it("404s a malformed id", async () => {
    setup();
    expect((await call("?subscription_id=nope")).status).toBe(404);
  });

  it("404s when there is no subscription", async () => {
    setup({ sub: null });
    expect((await call()).status).toBe(404);
  });
});
