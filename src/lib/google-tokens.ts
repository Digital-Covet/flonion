import { prisma } from "@/db/prisma";
import { decrypt, encrypt } from "./crypto";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

/**
 * Google OAuth tokens are stored per user in the database, encrypted at rest.
 *
 * They previously lived in a signed but client-readable cookie, which meant any
 * XSS on the app yielded a refresh token, and every caller passed the literal
 * string "default" as the user id — so token ownership was really "whoever's
 * browser sent the cookie". Both are fixed here.
 */

/**
 * Signals that the owner's Google grant is gone — no stored tokens, or Google
 * rejected the refresh token outright. Callers should prompt a reconnect.
 * Any other failure is transient and must NOT be reported this way.
 */
export class GoogleAuthRequiredError extends Error {
  constructor(message = "Not authenticated with Google") {
    super(message);
    this.name = "GoogleAuthRequiredError";
  }
}

async function readTokenSet(userId: string): Promise<TokenSet | null> {
  const row = await prisma.googleToken.findUnique({ where: { userId } });
  if (!row) return null;

  const accessToken = decrypt(row.accessToken);
  const refreshToken = decrypt(row.refreshToken);

  // Undecryptable rows mean a rotated/incorrect key. Treat as not connected,
  // but say so loudly: silently, this is indistinguishable from "never
  // connected", and it makes every owner appear to need a fresh integration.
  if (!accessToken || !refreshToken) {
    console.error(
      `[google-tokens] stored tokens for user ${userId} could not be decrypted. ` +
        "TOKEN_ENCRYPTION_KEY/COOKIE_SECRET has most likely changed; this user must reconnect Google.",
    );
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: row.expiresAt.getTime(),
    tokenType: row.tokenType,
  };
}

export async function storeTokens(
  userId: string,
  tokenData: TokenSet,
): Promise<void> {
  const data = {
    accessToken: encrypt(tokenData.accessToken),
    refreshToken: encrypt(tokenData.refreshToken),
    expiresAt: new Date(tokenData.expiresAt),
    tokenType: tokenData.tokenType ?? "Bearer",
  };

  await prisma.googleToken.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function getTokens(userId: string): Promise<TokenSet | undefined> {
  return (await readTokenSet(userId)) ?? undefined;
}

/**
 * Whether the owner has a usable Google grant.
 *
 * Deliberately keyed on the refresh token, not on `expiresAt`. Access tokens
 * expire hourly; the refresh token is what makes the connection durable.
 * Checking expiry here previously reported every owner as disconnected an hour
 * after connecting — ahead of `getValidAccessToken`, which would have quietly
 * refreshed — so they re-ran the integration on nearly every visit.
 */
export async function isGoogleConnected(userId: string): Promise<boolean> {
  const tokenSet = await readTokenSet(userId);
  return Boolean(tokenSet?.refreshToken);
}

export async function clearTokens(userId: string): Promise<void> {
  await prisma.googleToken.deleteMany({ where: { userId } });
}

/**
 * Google only returns a refresh token on the first consent. Preserve the
 * stored one when a refresh response omits it.
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  const tokenSet = await readTokenSet(userId);
  if (!tokenSet) throw new GoogleAuthRequiredError("No tokens found for user");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Missing Google OAuth env vars");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenSet.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    // Only `invalid_grant` means the grant itself is dead (revoked, expired, or
    // consent withdrawn). Deleting the row on any other failure meant a single
    // Google 5xx or rate-limit blip permanently disconnected the owner.
    if (body?.error === "invalid_grant") {
      await clearTokens(userId);
      throw new GoogleAuthRequiredError("Google refresh token was rejected");
    }

    console.error(
      "[google-tokens] refresh failed (tokens kept):",
      response.status,
      body?.error ?? response.statusText,
    );
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  const updated: TokenSet = {
    ...tokenSet,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokenSet.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await storeTokens(userId, updated);
  return updated.accessToken;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const tokenSet = await readTokenSet(userId);
  if (!tokenSet) throw new GoogleAuthRequiredError();

  if (Date.now() < tokenSet.expiresAt - 60_000) {
    return tokenSet.accessToken;
  }

  return refreshAccessToken(userId);
}
