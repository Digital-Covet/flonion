import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyCashfreeSignature } from "./index";

const SECRET = "test-webhook-secret";
const NOW = 1_780_000_000_000;
const BODY = '{"type":"SUBSCRIPTION_STATUS_CHANGED"}';

function sign(timestamp: string, body = BODY, secret = SECRET) {
  return createHmac("sha256", secret)
    .update(timestamp + body)
    .digest("base64");
}

describe("verifyCashfreeSignature", () => {
  beforeEach(() => {
    process.env.CASHFREE_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CASHFREE_WEBHOOK_SECRET;
  });

  it("accepts a fresh, correctly signed body (ms and s timestamps)", () => {
    const ms = String(NOW);
    const s = String(NOW / 1000);
    expect(verifyCashfreeSignature(BODY, sign(ms), ms, NOW)).toBe(true);
    expect(verifyCashfreeSignature(BODY, sign(s), s, NOW)).toBe(true);
  });

  it("rejects a tampered body or a wrong key", () => {
    const ts = String(NOW);
    expect(verifyCashfreeSignature(`${BODY} `, sign(ts), ts, NOW)).toBe(false);
    expect(
      verifyCashfreeSignature(BODY, sign(ts, BODY, "other"), ts, NOW),
    ).toBe(false);
  });

  it("rejects a replay outside the window", () => {
    const old = String(NOW - 11 * 60 * 1000);
    expect(verifyCashfreeSignature(BODY, sign(old), old, NOW)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    const ts = String(NOW);
    expect(verifyCashfreeSignature(BODY, null, ts, NOW)).toBe(false);
    expect(verifyCashfreeSignature(BODY, sign(ts), null, NOW)).toBe(false);
    expect(verifyCashfreeSignature(BODY, sign("abc"), "abc", NOW)).toBe(false);
  });
});
