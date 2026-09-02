import type { APIEvent } from "@solidjs/start/server"
import { clearTokens } from "~/lib/google-tokens"
import { getSessionFromHeaders } from "~/lib/server-auth"

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await clearTokens(session.user.id)
    return Response.json({ success: true, message: "Google account disconnected successfully" })
  } catch (err) {
    console.error("[google/disconnect] failed to clear tokens:", err)
    return Response.json({ error: "Failed to disconnect Google account" }, { status: 500 })
  }
}

export async function DELETE(event: APIEvent) {
  return POST(event)
}
