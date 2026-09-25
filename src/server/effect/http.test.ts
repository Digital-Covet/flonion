import { Cause, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));

const {
  BadRequest,
  Conflict,
  DbError,
  Forbidden,
  NotFound,
  RateLimited,
  RawResponse,
  Redirect,
  Unauthorized,
  UpstreamError,
} = await import("./errors");
const { exitToResponse } = await import("./http");

async function read(response: Response) {
  const text = await response.text();
  return {
    status: response.status,
    body: text === "" ? null : JSON.parse(text),
    retryAfter: response.headers.get("Retry-After"),
    location: response.headers.get("Location"),
  };
}

describe("exitToResponse", () => {
  it.each([
    [new Unauthorized({ message: "Unauthorized" }), 401],
    [new Forbidden({ message: "Nope" }), 403],
    [new NotFound({ message: "No business found" }), 404],
    [new BadRequest({ message: "Invalid request" }), 400],
    [new Conflict({ message: "Taken" }), 409],
    [new RateLimited({ message: "Slow down" }), 429],
    [new UpstreamError({ message: "Try again", status: 502 }), 502],
    [new UpstreamError({ message: "Try again", status: 503 }), 503],
  ])("maps %s to its status with an { error } body", async (error, status) => {
    const res = await read(exitToResponse("t", Exit.fail(error)));
    expect(res).toEqual({
      status,
      body: { error: error.message },
      retryAfter: null,
      location: null,
    });
  });

  it("adds Retry-After only when asked", async () => {
    const res = await read(
      exitToResponse(
        "t",
        Exit.fail(new RateLimited({ message: "x", retryAfterSec: 30 })),
      ),
    );
    expect(res.retryAfter).toBe("30");
  });

  it("passes a RawResponse through untouched", async () => {
    const response = new Response(null, { status: 503 });
    expect(exitToResponse("t", Exit.fail(new RawResponse({ response })))).toBe(
      response,
    );
  });

  it("turns Redirect into a 302", async () => {
    const res = await read(
      exitToResponse("t", Exit.fail(new Redirect({ location: "/login" }))),
    );
    expect(res).toMatchObject({ status: 302, location: "/login" });
  });

  it("hides DbError and defects behind a bare 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const exit of [
      Exit.fail(new DbError({ cause: new Error("connection refused") })),
      Exit.failCause(Cause.die(new Error("boom"))),
    ]) {
      const res = await read(exitToResponse("t", exit));
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error" });
    }
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("sends a success value as JSON, or a Response as-is", async () => {
    expect(await read(exitToResponse("t", Exit.succeed({ ok: true })))).toEqual(
      { status: 200, body: { ok: true }, retryAfter: null, location: null },
    );
    const response = new Response("hi", { status: 201 });
    expect(exitToResponse("t", Exit.succeed(response))).toBe(response);
  });
});
