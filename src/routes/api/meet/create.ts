import type { APIEvent } from "@solidjs/start/server"
import { getSessionFromHeaders } from "~/lib/server-auth"
import { createMeetLink } from "~/lib/google-meet"

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await createMeetLink(session.user.id)

  if (!result) {
    return Response.json(
      { error: "Failed to create Google Meet link. Ensure your Google account is connected with Meet permissions." },
      { status: 502 },
    )
  }

  return Response.json({ meetUri: result.meetUri })
}
