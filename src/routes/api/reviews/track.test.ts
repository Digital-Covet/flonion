import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeDb, fakeEvent, useRuntime } = await import(
  "~/server/effect/testing"
);
const { POST } = await import("./track");

function setup(opts: { found?: boolean; writeFails?: boolean } = {}) {
  const { found = true, writeFails = false } = opts;
  const upsert = vi.fn(async () =>
    writeFails ? Promise.reject(new Error("db down")) : {},
  );
  const executeRaw = vi.fn(async () => 1);
  useRuntime({
    db: fakeDb({
      sharedReview: {
        findUnique: async () => (found ? { id: "rev_1" } : null),
      },
      reviewAnalytics: { upsert },
      $executeRaw: executeRaw,
    }),
  });
  return { upsert, executeRaw };
}

async function call(init: Parameters<typeof fakeEvent>[0]) {
  const res = await POST(fakeEvent(init));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/reviews/track", () => {
  it("rejects a body that is not JSON", async () => {
    setup();
    expect(await call({ rawBody: "{" })).toEqual({
      status: 400,
      body: { error: "Invalid request" },
    });
  });

  it("keeps each validation message", async () => {
    setup();
    expect(await call({ body: { type: "visit" } })).toEqual({
      status: 400,
      body: { error: "reviewId is required" },
    });
    expect(await call({ body: { reviewId: "r", type: "click" } })).toEqual({
      status: 400,
      body: {
        error: "type must be 'visit', 'review', 'redirect', or 'ai_copy'",
      },
    });
    expect(
      await call({
        body: { reviewId: "r", type: "redirect", platform: "myspace" },
      }),
    ).toEqual({ status: 400, body: { error: "Unknown platform" } });
  });

  it("404s an unknown or hidden review", async () => {
    setup({ found: false });
    expect(await call({ body: { reviewId: "r", type: "visit" } })).toEqual({
      status: 404,
      body: { error: "Review not found" },
    });
  });

  it("counts a visit with an upsert, a platform redirect with raw SQL", async () => {
    const { upsert, executeRaw } = setup();
    expect(await call({ body: { reviewId: "r", type: "visit" } })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(upsert).toHaveBeenCalledOnce();

    expect(
      await call({
        body: { reviewId: "r", type: "redirect", platform: "google" },
      }),
    ).toEqual({ status: 200, body: { ok: true } });
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("answers a failed write with the same 400 as before", async () => {
    setup({ writeFails: true });
    expect(await call({ body: { reviewId: "r", type: "review" } })).toEqual({
      status: 400,
      body: { error: "Invalid request" },
    });
  });
});
