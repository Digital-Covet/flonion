import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { auth } from "~/lib/auth";
import { PLATFORM_ADMIN_ROLE } from "~/lib/roles";

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
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const token = url.searchParams.get("token");
  const sig = url.searchParams.get("sig");

  if (!token || !sig) {
    return new Response("Missing token or signature", { status: 403 });
  }

  const handoffSecret = process.env.OPERATOR_HANDOFF_SECRET;
  if (!handoffSecret) {
    return new Response("Impersonation not configured", { status: 500 });
  }

  // Verify HMAC
  const expectedBuf = createHmac("sha256", handoffSecret)
    .update(token)
    .digest();
  const actualBuf = Buffer.from(sig, "hex");
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return new Response("Invalid signature", { status: 403 });
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return new Response("Malformed token", { status: 403 });
  }

  const [userId, operatorId, expiresAtStr, nonce] = parts;
  const expiresAt = Number(expiresAtStr);

  if (
    !userId ||
    !operatorId ||
    !nonce ||
    !Number.isFinite(expiresAt) ||
    Date.now() > expiresAt
  ) {
    return new Response("Token expired", { status: 403 });
  }

  // Consume the nonce atomically. A findFirst-then-delete would let two
  // concurrent requests both see the row; deleteMany's count settles it. The
  // `value` match binds the nonce to the user it was minted for.
  const consumed = await prisma.verification.deleteMany({
    where: {
      identifier: `impersonate:${nonce}`,
      value: userId,
      expiresAt: { gt: new Date() },
    },
  });

  if (consumed.count !== 1) {
    return new Response("Token already used", { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, banned: true, banExpires: true },
  });

  if (!target) {
    return new Response("User not found", { status: 404 });
  }

  // Operator impersonation must not become a path to platform-admin rights.
  if (target.role?.split(",").includes(PLATFORM_ADMIN_ROLE)) {
    return new Response("Cannot impersonate a platform admin", {
      status: 403,
    });
  }

  // better-auth's ban check runs only inside its own endpoints, so repeat it.
  if (
    target.banned &&
    (!target.banExpires || target.banExpires.getTime() > Date.now())
  ) {
    return new Response("User is banned", { status: 403 });
  }

  try {
    const ctx = await auth.$context;
    const session = await ctx.internalAdapter.createSession(
      userId,
      false,
      {
        impersonatedBy: operatorId,
        expiresAt: new Date(Date.now() + IMPERSONATION_SESSION_SECONDS * 1000),
      },
      true,
    );

    if (!session) {
      throw new Error("createSession returned no session");
    }

    const cookie = ctx.authCookies.sessionToken;
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/dashboard", event.request.url).toString(),
      },
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
  } catch (err) {
    console.error("[impersonate] failed to create session:", err);
    return new Response("Failed to create impersonated session", {
      status: 500,
    });
  }
}

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
