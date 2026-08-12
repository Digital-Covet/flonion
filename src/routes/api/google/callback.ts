import type { APIEvent } from "@solidjs/start/server"
import { storeTokens } from "~/lib/google-tokens"
import { getSessionFromHeaders } from "~/lib/server-auth"
import { clearOAuthStateCookie, consumeOAuthState } from "~/lib/oauth-state"

function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

/**
 * Every exit from this handler is a redirect to an allowlisted in-app path.
 * Nothing from the query string or from Google is ever reflected into a
 * response body — previously `error`, `state`, and thrown error messages were
 * interpolated into inline HTML and a `<script>` block.
 */
function redirect(path: string, params: Record<string, string> = {}): Response {
  const query = new URLSearchParams(params).toString()
  const location = query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": clearOAuthStateCookie(),
      "Cache-Control": "no-store",
    },
  })
}

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(event.request.url)

  // Validated against the signed, HttpOnly state cookie issued by
  // /api/google/auth. A mismatch means the flow was not started by this user.
  const returnTo = consumeOAuthState(
    event.request.headers,
    url.searchParams.get("state"),
  )

  if (!returnTo) {
    return redirect("/settings", { google: "invalid_state" })
  }

  if (url.searchParams.get("error")) {
    return redirect(returnTo, { google: "denied" })
  }

  const code = url.searchParams.get("code")
  if (!code) {
    return redirect(returnTo, { google: "missing_code" })
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: getEnv("GOOGLE_CLIENT_ID"),
        client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: getEnv("GOOGLE_REDIRECT_URI"),
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text().catch(() => "")
      console.error("[google/callback] token exchange failed:", details)
      return redirect(returnTo, { google: "exchange_failed" })
    }

    const tokenData = await tokenResponse.json()

    await storeTokens(session.user.id, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      tokenType: tokenData.token_type,
    })

    return redirect(returnTo, { connected: "true" })
  } catch (err) {
    console.error("[google/callback] unexpected failure:", err)
    return redirect(returnTo, { google: "error" })
  }
}
