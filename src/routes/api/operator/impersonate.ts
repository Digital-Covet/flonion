import { createHmac, timingSafeEqual } from "node:crypto";
import { Effect, Option, Redacted } from "effect";
import { auth } from "~/lib/auth";
import { PLATFORM_ADMIN_ROLE } from "~/lib/roles";
import { optionalSecret } from "~/server/effect/config";
import { RawResponse } from "~/server/effect/errors";
import { recoverAll } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";

const IMPERSONATION_SESSION_SECONDS = 60 * 60;

/**
 * Impersonation receiver — called by the desk's handoff redirect.
 *
 * Trust comes from the desk's HMAC signature and a single-use nonce, not from
 * a better-auth admin session: the operator has no tenant account. The route
 * therefore creates the session itself through better-auth's internal adapter
 * and sets the signed session cookie the same way better-auth does.
 *
 * Query params: token (`userId.operatorId.expiresAt.nonce`), sig
 */
/** The plain-text refusals the desk's handoff has always received. */
const refuse = (body: string, status: number) =>
  new RawResponse({ response: new Response(body, { status }) });

export const GET = handler(
  "operator.impersonate",
  Effect.gen(function* () {
    const { url, request } = yield* RequestContext;
    const token = url.searchParams.get("token");
    const sig = url.searchParams.get("sig");

    if (!token || !sig) {
      return yield* refuse("Missing token or signature", 403);
    }

    const handoffSecret = yield* optionalSecret("OPERATOR_HANDOFF_SECRET");
    if (Option.isNone(handoffSecret)) {
      return yield* refuse("Impersonation not configured", 500);
    }

    // Verify HMAC
    const expectedBuf = createHmac(
      "sha256",
      Redacted.value(handoffSecret.value),
    )
      .update(token)
      .digest();
    const actualBuf = Buffer.from(sig, "hex");
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return yield* refuse("Invalid signature", 403);
    }

    const parts = token.split(".");
    if (parts.length !== 4) return yield* refuse("Malformed token", 403);

    const [userId, operatorId, expiresAtStr, nonce] = parts;
    const expiresAt = Number(expiresAtStr);
    if (
      !userId ||
      !operatorId ||
      !nonce ||
      !Number.isFinite(expiresAt) ||
      Date.now() > expiresAt
    ) {
      return yield* refuse("Token expired", 403);
    }

    // Consume the nonce atomically. A findFirst-then-delete would let two
    // concurrent requests both see the row; deleteMany's count settles it.
    // The `value` match binds the nonce to the user it was minted for.
    const db = yield* Db;
    const consumed = yield* db.use((p) =>
      p.verification.deleteMany({
        where: {
          identifier: `impersonate:${nonce}`,
          value: userId,
          expiresAt: { gt: new Date() },
        },
      }),
    );
    if (consumed.count !== 1) return yield* refuse("Token already used", 403);

    const target = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: userId },
        select: { role: true, banned: true, banExpires: true },
      }),
    );
    if (!target) return yield* refuse("User not found", 404);

    // Operator impersonation must not become a path to platform-admin rights.
    if (target.role?.split(",").includes(PLATFORM_ADMIN_ROLE)) {
      return yield* refuse("Cannot impersonate a platform admin", 403);
    }

    // better-auth's ban check runs only inside its own endpoints, so repeat it.
    if (
      target.banned &&
      (!target.banExpires || target.banExpires.getTime() > Date.now())
    ) {
      return yield* refuse("User is banned", 403);
    }

    return yield* Effect.tryPromise(async () => {
      const ctx = await auth.$context;
      const session = await ctx.internalAdapter.createSession(
        userId,
        false,
        {
          impersonatedBy: operatorId,
          expiresAt: new Date(
            Date.now() + IMPERSONATION_SESSION_SECONDS * 1000,
          ),
        },
        true,
      );
      if (!session) throw new Error("createSession returned no session");

      const cookie = ctx.authCookies.sessionToken;
      const response = new Response(null, {
        status: 302,
        headers: { Location: new URL("/dashboard", request.url).toString() },
      });
      response.headers.append(
        "Set-Cookie",
        serializeSignedCookie(
          cookie.name,
          session.token,
          ctx.secret,
          cookie.attributes,
          IMPERSONATION_SESSION_SECONDS,
        ),
      );
      return response;
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[impersonate] failed to create session:", cause),
        ),
      ),
      recoverAll(refuse("Failed to create impersonated session", 500)),
    );
  }),
);

interface CookieAttributes {
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string | boolean;
}

/**
 * Same format better-call's `setSignedCookie` writes and better-auth verifies:
 * `encodeURIComponent(value + "." + base64(HMAC-SHA256(secret, value)))`.
 */
function serializeSignedCookie(
  name: string,
  value: string,
  secret: string,
  attributes: CookieAttributes,
  maxAgeSeconds: number,
): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  let cookie = `${name}=${encodeURIComponent(`${value}.${signature}`)}`;
  cookie += `; Max-Age=${maxAgeSeconds}`;
  if (attributes.domain) cookie += `; Domain=${attributes.domain}`;
  cookie += `; Path=${attributes.path ?? "/"}`;
  if (attributes.httpOnly !== false) cookie += "; HttpOnly";
  if (attributes.secure) cookie += "; Secure";
  if (typeof attributes.sameSite === "string") {
    cookie += `; SameSite=${attributes.sameSite.charAt(0).toUpperCase()}${attributes.sameSite.slice(1)}`;
  }
  return cookie;
}
