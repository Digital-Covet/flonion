import { createMiddleware } from "@solidjs/start/middleware";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { isTrustedRequestOrigin } from "~/lib/trusted-origins";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/2fa",
  "/accept-invite",
];

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/reviews/share",
  "/api/reviews/track",
  "/api/ai/suggest-review",
  "/api/company/",
  "/qr/",
  "/review/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Match whole segments only: a bare `startsWith` would also treat
  // "/api/reviews/shareXYZ" as public.
  if (
    PUBLIC_PREFIXES.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
    )
  ) {
    return true;
  }
  // Allow public access to /company/*/review and /company/*/bookings sub-routes while protecting
  // the /company/:companyname profile page itself.
  const companyReviewMatch = pathname.match(/^\/company\/[^/]+\/review(?:\/.*)?$/);
  if (companyReviewMatch) return true;

  const companyBookingsMatch = pathname.match(/^\/company\/[^/]+\/bookings(?:\/.*)?$/);
  if (companyBookingsMatch) return true;

  return false;
}

/**
 * Defence-in-depth response headers.
 *
 * CSP is report-only for now: SolidStart inlines its hydration script, so an
 * enforcing policy needs `'unsafe-inline'` (which buys little) or per-request
 * nonces. Ship it in report-only, watch the reports, then tighten and enforce.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function applySecurityHeaders(headers: Headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);

  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
}

/**
 * h3 composes these onion-style, so `onBeforeResponse` never runs for a
 * response `onRequest` returns early. Every early return below goes through
 * this instead.
 */
function secured(response: Response): Response {
  applySecurityHeaders(response.headers);
  return response;
}

export default createMiddleware({
  onBeforeResponse: async (_event, response) => {
    if (response.body instanceof Response) {
      applySecurityHeaders(response.body.headers);
    }
  },

  onRequest: async (event) => {
    const { pathname } = new URL(event.request.url);

    // Origin validation for this app's own API routes. better-auth performs
    // its own equivalent check on /api/auth/*, so that prefix is skipped.
    if (
      pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/auth") &&
      STATE_CHANGING_METHODS.has(event.request.method) &&
      !isTrustedRequestOrigin(event.request)
    ) {
      return secured(Response.json({ error: "Forbidden" }, { status: 403 }));
    }

    if (isPublicPath(pathname)) return;

    const session = await getSessionFromHeaders(event.request.headers);

    event.locals.session = session;

    if (pathname.startsWith("/api/")) {
      if (!session) {
        return secured(
          Response.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }
      return;
    }

    if (!session) {
      const loginUrl = new URL("/login", event.request.url);
      loginUrl.searchParams.set("callbackURL", pathname);
      return secured(
        new Response(null, {
          status: 302,
          headers: { Location: loginUrl.toString() },
        }),
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true },
    });

    if (!user) return;

    if (!user.onboardingCompleted && pathname !== "/onboarding" && pathname !== "/accept-invite") {
      return secured(
        new Response(null, {
          status: 302,
          headers: { Location: "/onboarding" },
        }),
      );
    }

    if (user.onboardingCompleted && pathname === "/onboarding") {
      return secured(
        new Response(null, {
          status: 302,
          headers: { Location: "/dashboard" },
        }),
      );
    }
  },
});
