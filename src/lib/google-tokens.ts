import { prisma } from "@/db/prisma"
import { decrypt, encrypt } from "./crypto"

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
}

/**
 * Google OAuth tokens are stored per user in the database, encrypted at rest.
 *
 * They previously lived in a signed but client-readable cookie, which meant any
 * XSS on the app yielded a refresh token, and every caller passed the literal
 * string "default" as the user id — so token ownership was really "whoever's
 * browser sent the cookie". Both are fixed here.
 */

async function readTokenSet(userId: string): Promise<TokenSet | null> {
  const row = await prisma.googleToken.findUnique({ where: { userId } })
  if (!row) return null

  const accessToken = decrypt(row.accessToken)
  const refreshToken = decrypt(row.refreshToken)

  // Undecryptable rows mean a rotated/incorrect key. Treat as not connected.
  if (!accessToken || !refreshToken) return null

  return {
    accessToken,
    refreshToken,
    expiresAt: row.expiresAt.getTime(),
    tokenType: row.tokenType,
  }
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
  }

  await prisma.googleToken.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
}

export async function getTokens(userId: string): Promise<TokenSet | undefined> {
  return (await readTokenSet(userId)) ?? undefined
}

export async function hasValidTokens(userId: string): Promise<boolean> {
  const tokenSet = await readTokenSet(userId)
  if (!tokenSet) return false
  return Date.now() < tokenSet.expiresAt - 60_000
}

export async function clearTokens(userId: string): Promise<void> {
  await prisma.googleToken.deleteMany({ where: { userId } })
}

/**
 * Google only returns a refresh token on the first consent. Preserve the
 * stored one when a refresh response omits it.
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  const tokenSet = await readTokenSet(userId)
  if (!tokenSet) throw new Error("No tokens found for user")

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth env vars")

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenSet.refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    await clearTokens(userId)
    throw new Error("Failed to refresh access token")
  }

  const data = await response.json()
  const updated: TokenSet = {
    ...tokenSet,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokenSet.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  await storeTokens(userId, updated)
  return updated.accessToken
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const tokenSet = await readTokenSet(userId)
  if (!tokenSet) throw new Error("Not authenticated with Google")

  if (Date.now() < tokenSet.expiresAt - 60_000) {
    return tokenSet.accessToken
  }

  return refreshAccessToken(userId)
}
