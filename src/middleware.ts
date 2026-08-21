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
];

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/reviews/share",
  "/api/reviews/track",
  "/api/ai/suggest-review",
  "/qr/",
  "/review/",
  "/company/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Match whole segments only: a bare `startsWith` would also treat
  // "/api/reviews/shareXYZ" as public.
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}

export default createMiddleware({
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
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isPublicPath(pathname)) return;

    const session = await getSessionFromHeaders(event.request.headers);

    event.locals.session = session;

    if (pathname.startsWith("/api/")) {
      if (!session) {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401 },
        );
      }
      return;
    }

    if (!session) {
      const loginUrl = new URL("/login", event.request.url);
      loginUrl.searchParams.set("callbackURL", pathname);
      return new Response(null, {
        status: 302,
        headers: { Location: loginUrl.toString() },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true },
    });

    if (!user) return;

    if (!user.onboardingCompleted && pathname !== "/onboarding") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/onboarding" },
      });
    }

    if (user.onboardingCompleted && pathname === "/onboarding") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/dashboard" },
      });
    }
  },
});
