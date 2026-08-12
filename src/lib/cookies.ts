export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function readCookie(headers: Headers, name: string): string | null {
  const cookies = parseCookies(headers.get("Cookie") ?? "");
  return cookies[name] ?? null;
}

interface CookieOptions {
  maxAge?: number;
  path?: string;
  sameSite?: "Strict" | "Lax" | "None";
  httpOnly?: boolean;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const {
    maxAge,
    path = "/",
    sameSite = "Lax",
    httpOnly = true,
  } = options;

  const parts = [`${name}=${value}`, `Path=${path}`, `SameSite=${sameSite}`];

  if (httpOnly) parts.push("HttpOnly");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (process.env.NODE_ENV === "production") parts.push("Secure");

  return parts.join("; ");
}

export function expiredCookie(name: string, path = "/"): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax`;
}
