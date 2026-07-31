import type { APIEvent } from "@solidjs/start/server"

function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

export function GET(event: APIEvent) {
  const clientId = getEnv("GOOGLE_CLIENT_ID")
  const redirectUri = getEnv("GOOGLE_REDIRECT_URI")

  const url = new URL(event.request.url)
  const returnTo = url.searchParams.get("returnTo") || "/"

  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ]

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: returnTo,
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  })
}
