import { Effect, Exit, Layer, Option } from "effect";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { encrypt } from "~/lib/crypto";
import { fakeDb } from "../testing";
import { Google } from "./google";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key-32-bytes!!";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** An in-memory `googleToken` table with one optional row. */
function tokenTable(row?: { expiresInMs: number }) {
  let stored = row
    ? {
        userId: "u1",
        accessToken: encrypt("old-access"),
        refreshToken: encrypt("refresh-1"),
        expiresAt: new Date(Date.now() + row.expiresInMs),
        tokenType: "Bearer",
      }
    : null;
  const upsert = vi.fn(async (args: { update: typeof stored }) => {
    stored = { ...args.update, userId: "u1" } as typeof stored;
    return stored;
  });
  const deleteMany = vi.fn(async () => {
    stored = null;
    return { count: 1 };
  });
  const findUnique = vi.fn(async () => stored);
  const layer = fakeDb({
    googleToken: { findUnique, upsert, deleteMany },
  });
  return { layer, upsert, deleteMany, findUnique };
}

function stubFetch(respond: (url: string) => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: string) => respond(url));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function run<A, E>(
  table: ReturnType<typeof tokenTable>,
  program: (g: Google["Service"]) => Effect.Effect<A, E>,
) {
  return Effect.runPromiseExit(
    Google.use(program).pipe(
      Effect.provide(
        Google.layerWithoutDependencies.pipe(Layer.provide(table.layer)),
      ),
    ),
  );
}

describe("Google.accessToken", () => {
  it("returns a fresh token without calling Google", async () => {
    const fetch = stubFetch(() => new Response("{}"));
    const exit = await run(tokenTable({ expiresInMs: 3_600_000 }), (g) =>
      g.accessToken("u1"),
    );
    expect(exit).toEqual(Exit.succeed("old-access"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes an expiring token and keeps the stored refresh token", async () => {
    stubFetch(() =>
      Response.json({ access_token: "new-access", expires_in: 3600 }),
    );
    const table = tokenTable({ expiresInMs: 10_000 });
    const exit = await run(table, (g) => g.accessToken("u1"));
    expect(exit).toEqual(Exit.succeed("new-access"));
    expect(table.upsert).toHaveBeenCalledOnce();
    // Encrypted at rest: the stored value is not the plaintext.
    const saved = table.upsert.mock.calls[0][0].update as {
      refreshToken: string;
    };
    expect(saved.refreshToken).not.toBe("refresh-1");
  });

  it("drops the grant only when Google says invalid_grant", async () => {
    stubFetch(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    const table = tokenTable({ expiresInMs: 0 });
    const exit = await run(table, (g) => Effect.flip(g.accessToken("u1")));
    expect(Exit.isSuccess(exit) && exit.value._tag).toBe("GoogleAuthRequired");
    expect(table.deleteMany).toHaveBeenCalledOnce();
  });

  it("keeps the grant through a transient refresh failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(() => Response.json({ error: "backend" }, { status: 503 }));
    const table = tokenTable({ expiresInMs: 0 });
    const exit = await run(table, (g) => Effect.flip(g.accessToken("u1")));
    log.mockRestore();
    expect(Exit.isSuccess(exit) && exit.value._tag).toBe("GoogleUnavailable");
    expect(table.deleteMany).not.toHaveBeenCalled();
  });

  it("asks for a reconnect when nothing is stored", async () => {
    const exit = await run(tokenTable(), (g) =>
      Effect.flip(g.accessToken("u1")),
    );
    expect(Exit.isSuccess(exit) && exit.value._tag).toBe("GoogleAuthRequired");
  });
});

describe("Google.isConnectedCached", () => {
  it("caches the answer and forgets it when the grant changes", async () => {
    const table = tokenTable();
    const exit = await run(table, (g) =>
      Effect.gen(function* () {
        const before = yield* g.isConnectedCached("u1");
        const cached = yield* g.isConnectedCached("u1");
        yield* g.storeTokens("u1", {
          accessToken: "a",
          refreshToken: "r",
          expiresAt: Date.now() + 3_600_000,
          tokenType: "Bearer",
        });
        const after = yield* g.isConnectedCached("u1");
        return [before, cached, after];
      }),
    );
    expect(exit).toEqual(Exit.succeed([false, false, true]));
    // One read before the change (the second was cached), one after.
    expect(table.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("Google.createMeetLink", () => {
  it("is None when not connected, without calling Google", async () => {
    const fetch = stubFetch(() => new Response("{}"));
    const exit = await run(tokenTable(), (g) => g.createMeetLink("u1"));
    expect(exit).toEqual(Exit.succeed(Option.none()));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the join URL and space id", async () => {
    stubFetch(() =>
      Response.json({
        name: "spaces/abc123",
        meetingUri: "https://meet.google.com/abc-defg-hij",
      }),
    );
    const exit = await run(tokenTable({ expiresInMs: 3_600_000 }), (g) =>
      g.createMeetLink("u1"),
    );
    expect(exit).toEqual(
      Exit.succeed(
        Option.some({
          meetUri: "https://meet.google.com/abc-defg-hij",
          spaceId: "abc123",
        }),
      ),
    );
  });

  it("degrades to None when Google refuses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(() => new Response("nope", { status: 403 }));
    const exit = await run(tokenTable({ expiresInMs: 3_600_000 }), (g) =>
      g.createMeetLink("u1"),
    );
    log.mockRestore();
    expect(exit).toEqual(Exit.succeed(Option.none()));
  });
});
