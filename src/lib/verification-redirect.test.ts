import { describe, expect, it } from "vitest";
import {
  pickVerifyLinkError,
  verificationErrorRedirect,
} from "./verification-redirect";

const TOKEN = "a".repeat(64);

const redirectFor = (path: string) =>
  verificationErrorRedirect(new URL(path, "https://flonion.test"));

describe("verificationErrorRedirect", () => {
  it.each(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"])(
    "sends /onboarding?error=%s to /verify-email",
    (code) => {
      expect(redirectFor(`/onboarding?error=${code}`)).toBe(
        `/verify-email?error=${code}`,
      );
    },
  );

  it("carries an invitee's token through as `invite`", () => {
    expect(
      redirectFor(`/accept-invite?token=${TOKEN}&error=TOKEN_EXPIRED`),
    ).toBe(`/verify-email?error=TOKEN_EXPIRED&invite=${TOKEN}`);
  });

  it("ignores /accept-invite without a valid token", () => {
    expect(redirectFor("/accept-invite?error=TOKEN_EXPIRED")).toBeNull();
    expect(
      redirectFor("/accept-invite?token=nope&error=TOKEN_EXPIRED"),
    ).toBeNull();
  });

  it.each([
    "/onboarding",
    "/onboarding?error=SOMETHING_ELSE",
    "/onboarding?error=INVALID_USER",
    // Change-email failures come back here; a sign-up link can't fix them.
    "/account?section=email&error=TOKEN_EXPIRED",
    // /reset-password handles its own INVALID_TOKEN.
    "/reset-password?error=INVALID_TOKEN",
  ])("leaves %s alone", (path) => {
    expect(redirectFor(path)).toBeNull();
  });
});

describe("pickVerifyLinkError", () => {
  it("accepts known codes only", () => {
    expect(pickVerifyLinkError("TOKEN_EXPIRED")).toBe("TOKEN_EXPIRED");
    expect(pickVerifyLinkError(["INVALID_TOKEN", "x"])).toBe("INVALID_TOKEN");
    expect(pickVerifyLinkError("<script>")).toBeNull();
    expect(pickVerifyLinkError(undefined)).toBeNull();
  });
});
