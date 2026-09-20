import { getRequestEvent } from "solid-js/web";

export type AppSession = NonNullable<
  Awaited<ReturnType<typeof import("~/lib/server-auth").getSessionFromHeaders>>
>;

/**
 * The session for this request.
 *
 * `src/middleware.ts` already resolves it and stashes it on `event.locals`, so
 * the common path costs nothing. The fallback is what makes this safe to call
 * from anywhere: if a path is later added to `PUBLIC_PREFIXES`, or middleware
 * ordering changes, queries keep working instead of failing.
 *
 * This is the only place in the app that reads `event.locals`.
 */
export async function getSession(): Promise<AppSession | null> {
  // Must precede the first `await`: the request's AsyncLocalStorage store is
  // lost after one, and `getRequestEvent()` would return undefined.
  const event = getRequestEvent();
  if (!event) return null;

  // `undefined` means middleware never ran for this path; `null` means it ran
  // and found nobody. Only the former should fall through to a lookup.
  if (event.locals.session !== undefined) return event.locals.session ?? null;

  const { getSessionFromHeaders } = await import("~/lib/server-auth");
  const session = await getSessionFromHeaders(event.request.headers);
  event.locals.session = session;
  return session;
}

/** As `getSession`, but redirects to the login page instead of returning null. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("@solidjs/router");
    throw redirect("/login", { revalidate: [] });
  }
  return session;
}
