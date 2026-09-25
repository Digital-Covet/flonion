import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

process.env.TOKEN_ENCRYPTION_KEY ??= "test-token-encryption-key-32-bytes!!";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const {
  fakeAuth,
  fakeDb,
  fakeEvent,
  fakeGoogle,
  fakeLlm,
  fakeSession,
  useRuntime,
} = await import("~/server/effect/testing");
const draftReply = await import("./ai/draft-reply");
const share = await import("./reviews/share");
const business = await import("./business");
const qr = await import("../qr/[id]");

const sentimentJson = JSON.stringify({
  overallSentiment: "positive",
  sentimentScore: 0.8,
  sentimentWords: [{ word: "great", category: "praise", intensity: "high" }],
  keyTopics: ["service"],
  customerIntent: "compliment",
});

async function read(res: Response) {
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Lets the detached ledger fibers finish before the test inspects them. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("POST /api/ai/draft-reply", () => {
  function setup(answers: Array<string | Error>) {
    const ledger = vi.fn(async (args: { data: object }) => args.data);
    useRuntime({
      auth: fakeAuth(fakeSession()),
      llm: fakeLlm(answers),
      db: fakeDb({
        user: {
          findUnique: async () => ({
            businessId: "b1",
            role: "owner",
            business: { id: "b1" },
          }),
        },
        aiUsage: { create: ledger },
      }),
    });
    return { ledger };
  }

  it("runs both stages and records their spend", async () => {
    const { ledger } = setup([
      sentimentJson,
      JSON.stringify({ draftReply: "Thank you!" }),
    ]);
    const res = await read(
      await draftReply.POST(
        fakeEvent({ body: { comment: "Great service", starRating: 5 } }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.draftReply).toBe("Thank you!");
    expect(res.body.sentiment.overallSentiment).toBe("positive");

    await settle();
    expect(ledger).toHaveBeenCalledTimes(2);
    expect(ledger.mock.calls[0][0].data).toMatchObject({
      endpoint: "draft-reply",
      ok: true,
      businessId: "b1",
    });
  });

  it("hides an off-schema model answer behind the generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ledger } = setup(["not json at all"]);
    const res = await read(
      await draftReply.POST(
        fakeEvent({ body: { comment: "Great", starRating: 5 } }),
      ),
    );
    log.mockRestore();
    expect(res).toEqual({
      status: 500,
      body: { error: "Could not generate a reply. Please try again." },
    });

    await settle();
    expect(ledger.mock.calls[0][0].data).toMatchObject({
      ok: false,
      stage: "pipeline",
      errorKind: "LlmError",
    });
  });

  it("skips the model for a rating-only review's sentiment", async () => {
    setup([JSON.stringify({ draftReply: "Thanks for the stars" })]);
    const res = await read(
      await draftReply.POST(
        fakeEvent({ body: { comment: "", starRating: 4 } }),
      ),
    );
    expect(res.body.sentiment.overallSentiment).toBe("positive");
  });
});

describe("POST /api/reviews/share (anonymous visitor)", () => {
  it("creates a review row and hands back its claim token", async () => {
    useRuntime({
      db: fakeDb({
        business: {
          findUnique: async () => ({
            id: "b1",
            userId: "owner",
            keywords: "coffee",
          }),
        },
        sharedReview: { create: async () => ({ id: "r1" }) },
      }),
    });
    const res = await read(
      await share.POST(fakeEvent({ body: { username: "acme", rating: 5 } })),
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, reviewId: "r1" });
    expect(typeof res.body.claimToken).toBe("string");
  });

  it("refuses to overwrite a row without its claim token", async () => {
    useRuntime({
      db: fakeDb({
        sharedReview: {
          findUnique: async () => ({ id: "r1", userId: "owner", rating: 5 }),
        },
      }),
    });
    const res = await read(
      await share.POST(fakeEvent({ body: { id: "r1", rating: 1, text: "x" } })),
    );
    expect(res).toEqual({ status: 403, body: { error: "Forbidden" } });
  });
});

describe("PATCH /api/business (username check)", () => {
  it("reports shape problems with `available: false`", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()) });
    const res = await read(
      await business.PATCH(
        fakeEvent({ method: "PATCH", body: { username: "Admin" } }),
      ),
    );
    expect(res).toEqual({
      status: 400,
      body: { available: false, error: "This username is reserved" },
    });
  });

  it("says whether another owner holds the name", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ business: { findFirst: async () => ({ id: "other" }) } }),
    });
    const res = await read(
      await business.PATCH(
        fakeEvent({ method: "PATCH", body: { username: "acme" } }),
      ),
    );
    expect(res).toEqual({
      status: 200,
      body: { available: false, error: "Username is already taken" },
    });
  });

  it("caches Google's rating on save without blocking it", async () => {
    const update = vi.fn(async (args: { data: object }) => ({
      id: "b1",
      name: "Acme",
      placeId: "place",
      ...args.data,
    }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      google: fakeGoogle({
        businessRating: () =>
          Effect.succeed(Option.some({ rating: 4.6, reviewCount: 12 })),
      }),
      db: fakeDb({
        user: {
          findUnique: async () => ({ businessId: null, business: null }),
          update: async () => ({}),
        },
        business: {
          upsert: async () => ({ id: "b1", name: "Acme", placeId: "place" }),
          update,
        },
        joinRequest: { updateMany: async () => ({ count: 0 }) },
      }),
    });
    const res = await read(
      await business.POST(
        fakeEvent({ body: { businessName: "Acme", placeId: "place" } }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rating: 4.6, reviewCount: 12 });
  });
});

describe("GET /qr/:id", () => {
  function scan(id: string, userAgent = "Mozilla/5.0") {
    const request = new Request(`http://localhost/qr/${id}`, {
      headers: { "user-agent": userAgent, "x-real-ip": "203.0.113.9" },
    });
    return qr.GET({ request, params: { id }, locals: {} } as never);
  }

  it("redirects a live review request and counts the scan", async () => {
    const executeRaw = vi.fn(async () => 1);
    useRuntime({
      db: fakeDb({
        sharedReview: {
          findUnique: async () => ({
            id: "rev1",
            status: "visible",
            business: { name: "Acme", status: "active" },
            user: { business: null },
          }),
        },
        $executeRaw: executeRaw,
      }),
    });
    const res = await scan("rev1");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/review/rev1");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("does not count link-preview bots", async () => {
    const executeRaw = vi.fn(async () => 1);
    useRuntime({
      db: fakeDb({
        sharedReview: {
          findUnique: async () => ({
            id: "rev1",
            status: "visible",
            business: { name: "Acme", status: "active" },
            user: { business: null },
          }),
        },
        $executeRaw: executeRaw,
      }),
    });
    const res = await scan("rev1", "WhatsApp/2.23");
    expect(res.status).toBe(302);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("names the business on an inactive code", async () => {
    useRuntime({
      db: fakeDb({
        sharedReview: { findUnique: async () => null },
        business: {
          findFirst: async () => ({
            id: "b1",
            name: "Acme & Co",
            username: "acme",
            status: "suspended",
          }),
        },
      }),
    });
    const res = await scan("acme");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(
      "Acme &amp; Co has switched this code off",
    );
  });

  it("shows the error page with a reference when the database fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    useRuntime({
      db: fakeDb({
        sharedReview: {
          findUnique: async () => Promise.reject(new Error("db down")),
        },
      }),
    });
    const res = await scan("rev1");
    log.mockRestore();
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("Reference:");
  });
});
