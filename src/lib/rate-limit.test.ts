import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows max requests per window, then refuses until it resets", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const key = `test:${Math.random()}`;
    for (let i = 2; i >= 0; i--) {
      expect(checkRateLimit(key, 3, 60_000)).toMatchObject({
        allowed: true,
        remaining: i,
      });
    }
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit(key, 3, 60_000)).toMatchObject({
      allowed: true,
      remaining: 2,
    });
  });
});

describe("getClientIp", () => {
  it("reads the trusted header and refuses chains", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = (value?: string) =>
      new Request("http://x", {
        headers: value ? { "x-real-ip": value } : {},
      });
    expect(getClientIp(req("203.0.113.9"))).toBe("203.0.113.9");
    expect(getClientIp(req("203.0.113.9, 10.0.0.1"))).toBe("unknown");
    expect(getClientIp(req())).toBe("unknown");
    warn.mockRestore();
  });
});
