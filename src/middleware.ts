import { createMiddleware } from "@solidjs/start/middleware";
import { prisma } from "~/db/prisma";
import { inviteCallbackUrl, pickInviteToken } from "~/lib/invite-redirect";
import { safeRedirectPath } from "~/lib/post-login-redirect";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { isTrustedRequestOrigin } from "~/lib/trusted-origins";

/**
 * A net, not a fix: Node has defaulted to `--unhandled-rejections=throw` since
 * v15, so one discarded promise rejection anywhere on the server takes the
 * whole process down and every tenant's in-flight requests with it. Each such
 * rejection is still a bug to fix at its call site -- this only stops one from
 * being an outage. Registered here because this module is evaluated once, on
 * the server, at startup.
 */
if (!globalThis.__revmeRejectionGuard) {
  globalThis.__revmeRejectionGuard = true;
  process.on("unhandledRejection", (reason) => {
    console.error("[server] Unhandled promise rejection:", reason);
  });
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Where SolidStart serves server functions (`SERVER_FN_BASE` in its handler). */
const SERVER_FN_BASE = "/_server";

const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/2fa",
  "/accept-invite",
  "/suspended",
];

/** Signed-in visitors are sent past these to where they were headed. */
const GUEST_ONLY_PATHS = new Set(["/login", "/signup"]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/reviews/share",
  "/api/reviews/track",
  "/api/ai/suggest-review",
  "/api/company/",
  "/api/marketplace/partner",
  // The operator arrives without a tenant session; the route authenticates
  // the desk's signed, single-use handoff token itself.
  "/api/operator/impersonate",
  // Vercel Cron has no session; each route checks CRON_SECRET itself.
  "/api/cron/",
  // Cashfree has no session; the route verifies the webhook's HMAC signature
  // and re-reads everything from Cashfree's API before acting.
  "/api/webhooks/cashfree",
  // No bare "/company/" here: it would swallow the whole subtree, including
  // the signed-in profile page, and leave that page without `no-store`. The
  // public sub-routes are matched by the regexes in `isPublicPath`.
  "/qr/",
  "/review/",
];

function isServerFunction(pathname: string): boolean {
  return (
    pathname === SERVER_FN_BASE || pathname.startsWith(`${SERVER_FN_BASE}/`)
  );
}

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
  const companyReviewMatch = pathname.match(
    /^\/company\/[^/]+\/review(?:\/.*)?$/,
  );
  if (companyReviewMatch) return true;

  // Emailed accept/reject links must work for a logged-out owner. The handler
  // authorizes every method itself: a signed, expiring link or the owner's
  // session. Only the single-meeting path is public, not the listing.
  if (/^\/api\/marketplace\/meetings\/[^/]+$/.test(pathname)) return true;

  const companyBookingsMatch = pathname.match(
    /^\/company\/[^/]+\/bookings(?:\/.*)?$/,
  );
  if (companyBookingsMatch) return true;

  return false;
}

/**
 * The per-user state the gate below needs, in one primary-key lookup. A user
 * reaches a business either as its owner or as a team member, never both, and
 * a suspension on either locks them out.
 */
async function loadAccountGate(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleted: true,
      business: { select: { status: true } },
      team: { select: { status: true } },
    },
  });
  if (!user) return null;
  return {
    onboardingCompleted: user.onboardingCompleted,
    suspended:
      user.business?.status === "suspended" ||
      user.team?.status === "suspended",
  };
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
  // Cashfree.js is loaded from its CDN only when checkout opens on /upgrade.
  "script-src 'self' 'unsafe-inline' https://sdk.cashfree.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Cashfree's hosted checkout may post the customer on to its own pages.
  "form-action 'self' https://*.cashfree.com",
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
  // Every early return is either a redirect away from a protected page or a
  // refusal, and neither should ever be cached.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export default createMiddleware({
  onBeforeResponse: async (event, response) => {
    // A streamed page resolves to an iterable rather than a Response, so the
    // branch below never fires for one and its headers would be dropped.
    // `event.response` is the header bag SolidStart also writes the page's
    // Content-Type to, and it survives the streaming path.
    //
    // This belongs here rather than in `onRequest`: reading `event.response`
    // before the handler runs breaks SolidStart's own URL handling in dev.
    applySecurityHeaders(event.response.headers);

    // Nothing signed-in may be stored by a shared cache. This is the guard
    // that makes marking the public pages cacheable safe.
    if (!isPublicPath(new URL(event.request.url).pathname)) {
      event.response.headers.set("Cache-Control", "private, no-store");
    }

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

    // Server functions are not navigations, so they must never be redirected:
    // a 302 to /login would be parsed as the function's result. Public pages
    // call queries from here too, so authenticate optionally and let each
    // query decide for itself via `requireSession()`.
    if (isServerFunction(pathname)) {
      const session = await getSessionFromHeaders(event.request.headers);
      // A suspended member is treated as signed out, so every query's own
      // `requireSession()` refuses them without knowing about suspension.
      const gate = session ? await loadAccountGate(session.user.id) : null;
      event.locals.session = gate?.suspended ? null : session;
      return;
    }

    // The landing page's "Log in" CTA is rendered before the client session
    // resolves, so a signed-in visitor can still reach the auth forms. Send
    // them on from here; the gate below then handles suspension/onboarding.
    if (GUEST_ONLY_PATHS.has(pathname) && event.request.method === "GET") {
      const session = await getSessionFromHeaders(event.request.headers);
      if (session) {
        const params = new URL(event.request.url).searchParams;
        const target = inviteCallbackUrl(
          pickInviteToken(params.get("invite") ?? undefined),
          safeRedirectPath(params.get("callbackURL")),
        );
        return secured(
          new Response(null, { status: 302, headers: { Location: target } }),
        );
      }
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
      const gate = await loadAccountGate(session.user.id);
      if (gate?.suspended) {
        return secured(
          Response.json({ error: "Business suspended" }, { status: 403 }),
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

    const user = await loadAccountGate(session.user.id);

    if (!user) return;

    if (user.suspended) {
      return secured(
        new Response(null, {
          status: 302,
          headers: { Location: "/suspended" },
        }),
      );
    }

    // Stashed so server functions never repeat this lookup.
    event.locals.onboardingCompleted = user.onboardingCompleted;

    if (
      !user.onboardingCompleted &&
      pathname !== "/onboarding" &&
      pathname !== "/accept-invite"
    ) {
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
