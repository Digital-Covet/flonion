import type { APIEvent } from "@solidjs/start/server"
import { storeTokens } from "~/lib/google-tokens"
import { getSessionFromHeaders } from "~/lib/server-auth"

function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

function sanitizeReturnUrl(state: string | null): string {
  if (!state || !state.startsWith("/")) return "/"
  if (state.startsWith("//")) return "/"
  return state
}

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(event.request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const state = sanitizeReturnUrl(url.searchParams.get("state"))
  const returnWithParam = state.includes("?") ? `${state}&connected=true` : `${state}?connected=true`

  if (error) {
    return new Response(
      `<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><script>window.location.href="${state}";</script><a href="${state}">Return</a></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  if (!code) {
    return new Response(
      `<html><body><h1>Missing Authorization Code</h1><script>window.location.href="${state}";</script><a href="${state}">Return</a></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  try {
    const clientId = getEnv("GOOGLE_CLIENT_ID")
    const clientSecret = getEnv("GOOGLE_CLIENT_SECRET")
    const redirectUri = getEnv("GOOGLE_REDIRECT_URI")

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      throw new Error(errorData.error_description || "Token exchange failed")
    }

    const tokenData = await tokenResponse.json()

    storeTokens("default", {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      tokenType: tokenData.token_type,
    })

    return new Response(
      `<html><body><h1>Authentication Successful!</h1><p>You are now connected to Google Business Profile.</p><script>window.location.href="${returnWithParam}";</script><a href="${returnWithParam}">Return</a></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(
      `<html><body><h1>Authentication Error</h1><p>${message}</p><script>window.location.href="${state}";</script><a href="${state}">Return</a></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } },
    )
  }
}
