import { describe, expect, it } from "vitest";
import { describeUserAgent, deviceLabel } from "./user-agent";

const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  operaMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  firefoxLinux:
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeAndroidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsungAndroidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36",
};

describe("describeUserAgent", () => {
  it.each([
    [UA.chromeWindows, "Chrome", "Windows", "desktop"],
    [UA.edgeWindows, "Edge", "Windows", "desktop"],
    [UA.operaMac, "Opera", "macOS", "desktop"],
    [UA.safariMac, "Safari", "macOS", "desktop"],
    [UA.firefoxLinux, "Firefox", "Linux", "desktop"],
    [UA.chromeOs, "Chrome", "ChromeOS", "desktop"],
    [UA.safariIphone, "Safari", "iOS", "mobile"],
    [UA.chromeIphone, "Chrome", "iOS", "mobile"],
    [UA.safariIpad, "Safari", "iPadOS", "tablet"],
    [UA.chromeAndroidPhone, "Chrome", "Android", "mobile"],
    [UA.samsungAndroidTablet, "Samsung Internet", "Android", "tablet"],
  ])("reads %s", (ua, browser, os, kind) => {
    expect(describeUserAgent(ua)).toEqual({ browser, os, kind });
  });

  it("knows nothing about a missing or unrecognised agent", () => {
    const unknown = { browser: null, os: null, kind: "unknown" };
    expect(describeUserAgent(null)).toEqual(unknown);
    expect(describeUserAgent("")).toEqual(unknown);
    expect(describeUserAgent("curl/8.4.0")).toEqual(unknown);
  });
});

describe("deviceLabel", () => {
  it("names what it can", () => {
    expect(deviceLabel(describeUserAgent(UA.chromeWindows))).toBe(
      "Chrome on Windows",
    );
    expect(deviceLabel({ browser: "Safari", os: null, kind: "unknown" })).toBe(
      "Safari",
    );
    expect(deviceLabel({ browser: null, os: "Android", kind: "mobile" })).toBe(
      "Android device",
    );
    expect(deviceLabel(describeUserAgent(null))).toBe("Unknown device");
  });
});
