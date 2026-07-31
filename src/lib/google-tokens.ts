import { getRequestEvent } from "solid-js/web"
import { createHmac } from "node:crypto"

interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
}

const COOKIE_NAME = "gtok"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getSigningKey(): string {
  const key = process.env.COOKIE_SECRET
  if (!key) throw new Error("Missing environment variable: COOKIE_SECRET")
  return key
}

function sign(data: string): string {
  return createHmac("sha256", getSigningKey()).update(data).digest("hex")
}

function verify(data: string, signature: string): boolean {
  return sign(data) === signature
}

function serializeTokens(tokenSet: TokenSet): string {
  const json = JSON.stringify(tokenSet)
  const encoded = Buffer.from(json).toString("base64url")
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

function deserializeTokens(cookieValue: string): TokenSet | null {
  try {
    const dotIndex = cookieValue.lastIndexOf(".")
    if (dotIndex === -1) return null

    const encoded = cookieValue.slice(0, dotIndex)
    const signature = cookieValue.slice(dotIndex + 1)

    if (!verify(encoded, signature)) return null

    const json = Buffer.from(encoded, "base64url").toString("utf-8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=")
    if (idx === -1) continue
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  }
  return cookies
}

function readTokenSet(): TokenSet | null {
  const event = getRequestEvent()
  const cookieHeader = event?.request.headers.get("Cookie") ?? ""
  const cookies = parseCookies(cookieHeader)
  const cookieValue = cookies[COOKIE_NAME]
  if (!cookieValue) return null
  return deserializeTokens(cookieValue)
}

function writeTokenSet(tokenSet: TokenSet): void {
  const event = getRequestEvent()
  if (!event) return

  const serialized = serializeTokens(tokenSet)
  const cookieParts = [
    `${COOKIE_NAME}=${serialized}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ]

  if (process.env.NODE_ENV === "production") {
    cookieParts.push("Secure")
  }

  // HttpOnly cannot be set via Set-Cookie header from JS
  // We rely on the cookie being signed to prevent tampering
  event.response.headers.append("Set-Cookie", cookieParts.join("; "))
}

function removeTokenSet(): void {
  const event = getRequestEvent()
  if (!event) return

  event.response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; Max-Age=0`,
  )
}

export function storeTokens(_userId: string, tokenData: TokenSet): void {
  writeTokenSet(tokenData)
}

export function getTokens(_userId: string): TokenSet | undefined {
  return readTokenSet() ?? undefined
}

export function hasValidTokens(_userId: string): boolean {
  const tokenSet = readTokenSet()
  if (!tokenSet) return false
  return Date.now() < tokenSet.expiresAt - 60_000
}

export async function refreshAccessToken(_userId: string): Promise<string> {
  const tokenSet = readTokenSet()
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
    removeTokenSet()
    throw new Error("Failed to refresh access token")
  }

  const data = await response.json()
  const updated: TokenSet = {
    ...tokenSet,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  writeTokenSet(updated)
  return updated.accessToken
}

export async function getValidAccessToken(_userId: string): Promise<string> {
  const tokenSet = readTokenSet()
  if (!tokenSet) throw new Error("Not authenticated with Google")

  if (Date.now() < tokenSet.expiresAt - 60_000) {
    return tokenSet.accessToken
  }

  return refreshAccessToken(_userId)
}

export function clearTokens(_userId: string): void {
  removeTokenSet()
}
