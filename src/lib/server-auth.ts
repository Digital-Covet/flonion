import { auth } from "./auth";

/**
 * better-auth's admin plugin refuses sign-in to a banned user but keeps honouring
 * a session opened before the ban. Every request authenticates through here, so
 * checking the ban on the session's user closes that gap for pages, API routes
 * and server functions alike. `banExpires` NULL means the ban is indefinite.
 */
function isActivelyBanned(user: {
  banned?: boolean | null;
  banExpires?: Date | string | null;
}): boolean {
  if (!user.banned) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}

export async function getSessionFromHeaders(headers: Headers) {
  try {
    const session = await auth.api.getSession({
      headers,
    });
    if (session && isActivelyBanned(session.user)) return null;
    return session;
  } catch {
    return null;
  }
}
