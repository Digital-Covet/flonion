import { auth } from "./auth";

export async function getSessionFromHeaders(headers: Headers) {
  try {
    const session = await auth.api.getSession({
      headers,
    });
    return session;
  } catch {
    return null;
  }
}
