import { createMiddleware } from "@solidjs/start/middleware";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/reviews/share",
  "/api/ai/suggest-review",
  "/review/",
  "/company/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default createMiddleware({
  onRequest: async (event) => {
    const { pathname } = new URL(event.request.url);

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
