import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeDb, fakeEvent, fakeSession, useRuntime } = await import(
  "~/server/effect/testing"
);
const sessions = await import("./index");
const one = await import("./[id]");

type AppSession = ReturnType<typeof fakeSession>;

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

/** The signed-in caller, on session `sess_current`. */
function caller(impersonatedBy: string | null = null): AppSession {
  const base = fakeSession();
  return {
    ...base,
    session: { id: "sess_current", impersonatedBy },
  } as unknown as AppSession;
}

function deleteEvent(id?: string) {
  const e = fakeEvent({ method: "DELETE" });
  if (id) (e as { params: Record<string, string> }).params = { id };
  return e;
}

const chrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

describe("GET /api/account/sessions", () => {
  it("401s a signed-out caller", async () => {
    useRuntime({ auth: fakeAuth(null) });
    const res = await read(await sessions.GET(fakeEvent({ method: "GET" })));
    expect(res.status).toBe(401);
  });

  it("lists live, non-impersonated sessions with this device first", async () => {
    const findMany = vi.fn(async (_args: unknown) => [
      {
        id: "sess_phone",
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-27T00:00:00Z"),
        ipAddress: "198.51.100.7",
        userAgent: iphone,
      },
      {
        id: "sess_current",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        updatedAt: new Date("2026-09-26T00:00:00Z"),
        ipAddress: "203.0.113.1",
        userAgent: chrome,
      },
    ]);
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({ session: { findMany } }),
    });

    const res = await read(await sessions.GET(fakeEvent({ method: "GET" })));

    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([
      {
        id: "sess_current",
        current: true,
        browser: "Chrome",
        os: "Windows",
        kind: "desktop",
        ipAddress: "203.0.113.1",
        createdAt: "2026-09-20T00:00:00.000Z",
        lastActiveAt: "2026-09-26T00:00:00.000Z",
      },
      {
        id: "sess_phone",
        current: false,
        browser: "Safari",
        os: "iOS",
        kind: "mobile",
        ipAddress: "198.51.100.7",
        createdAt: "2026-09-01T00:00:00.000Z",
        lastActiveAt: "2026-09-27T00:00:00.000Z",
      },
    ]);
    const { where } = findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(where).toMatchObject({ userId: "user_1", impersonatedBy: null });
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it("never returns session tokens", async () => {
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({
        session: {
          findMany: async (args: { select: Record<string, boolean> }) => {
            expect(args.select).not.toHaveProperty("token");
            return [];
          },
        },
      }),
    });
    const res = await read(await sessions.GET(fakeEvent({ method: "GET" })));
    expect(res.body).toEqual({ sessions: [] });
  });
});

describe("DELETE /api/account/sessions", () => {
  it("logs out every session but this one", async () => {
    const deleteMany = vi.fn(async (_args: unknown) => ({ count: 2 }));
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({ session: { deleteMany } }),
    });

    const res = await read(await sessions.DELETE(deleteEvent()));

    expect(res).toEqual({ status: 200, body: { revoked: 2 } });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", id: { not: "sess_current" } },
    });
  });

  it("403s an operator viewing as the user", async () => {
    const deleteMany = vi.fn();
    useRuntime({
      auth: fakeAuth(caller("operator_1")),
      db: fakeDb({ session: { deleteMany } }),
    });

    const res = await read(await sessions.DELETE(deleteEvent()));

    expect(res.status).toBe(403);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/account/sessions/:id", () => {
  it("logs out one of the caller's sessions", async () => {
    const deleteMany = vi.fn(async (_args: unknown) => ({ count: 1 }));
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({ session: { deleteMany } }),
    });

    const res = await read(await one.DELETE(deleteEvent("sess_phone")));

    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "sess_phone", userId: "user_1", impersonatedBy: null },
    });
  });

  it("refuses to end the current session", async () => {
    const deleteMany = vi.fn();
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({ session: { deleteMany } }),
    });

    const res = await read(await one.DELETE(deleteEvent("sess_current")));

    expect(res).toEqual({
      status: 400,
      body: { error: "Use Log out to end this session" },
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("404s a session the caller doesn't own", async () => {
    useRuntime({
      auth: fakeAuth(caller()),
      db: fakeDb({ session: { deleteMany: async () => ({ count: 0 }) } }),
    });

    const res = await read(await one.DELETE(deleteEvent("sess_someone_else")));

    expect(res).toEqual({ status: 404, body: { error: "Session not found" } });
  });

  it("403s an operator viewing as the user", async () => {
    const deleteMany = vi.fn();
    useRuntime({
      auth: fakeAuth(caller("operator_1")),
      db: fakeDb({ session: { deleteMany } }),
    });

    const res = await read(await one.DELETE(deleteEvent("sess_phone")));

    expect(res.status).toBe(403);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
