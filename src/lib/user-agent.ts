/**
 * Enough of a user-agent reading to label a signed-in device ("Chrome on
 * Windows", phone vs computer). Not for feature detection or anything
 * security-relevant: the string is whatever the client chose to send.
 */

export type DeviceKind = "desktop" | "mobile" | "tablet" | "unknown";

export interface DeviceInfo {
  readonly browser: string | null;
  readonly os: string | null;
  readonly kind: DeviceKind;
}

/** First match wins, so browsers that also claim "Chrome" or "Safari" go first. */
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bEdg(e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

/** iPadOS in desktop mode sends a Mac user agent and is labelled macOS. */
const OSES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\biPad\b/, "iPadOS"],
  [/\biPhone\b|\biPod\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

function first(ua: string, table: ReadonlyArray<readonly [RegExp, string]>) {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: null, os: null, kind: "unknown" };

  const os = first(ua, OSES);
  const browser = first(ua, BROWSERS);

  const kind: DeviceKind =
    os === "iPadOS" || (os === "Android" && !/\bMobile\b/.test(ua))
      ? "tablet"
      : os === "iOS" || os === "Android"
        ? "mobile"
        : os
          ? "desktop"
          : "unknown";

  return { browser, os, kind };
}

/** "Chrome on Windows", "Safari", "Android device", or "Unknown device". */
export function deviceLabel(info: DeviceInfo): string {
  if (info.browser && info.os) return `${info.browser} on ${info.os}`;
  if (info.browser) return info.browser;
  if (info.os) return `${info.os} device`;
  return "Unknown device";
}
