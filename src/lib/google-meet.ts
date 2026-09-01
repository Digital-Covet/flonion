import { getValidAccessToken, hasValidTokens } from "./google-tokens"

export interface MeetLink {
  meetUri: string
  spaceId: string
}

/**
 * Creates a Google Meet space and returns the join URL.
 *
 * Uses the REST API directly instead of the `@google-apps/meet` client
 * library to avoid deep dependency-chain overhead. The user's stored
 * OAuth2 access token (scoped to `meetings.space.created`) is sent
 * as a Bearer token.
 *
 * Returns `null` on any failure so callers can degrade gracefully.
 */
export async function createMeetLink(userId: string): Promise<MeetLink | null> {
  try {
    if (!(await hasValidTokens(userId))) return null

    const accessToken = await getValidAccessToken(userId)

    const response = await fetch("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error("[google-meet] createSpace failed:", response.status, body)
      return null
    }

    const data: { name?: string; meetingUri?: string } = await response.json()

    if (!data.meetingUri || !data.name) {
      console.error("[google-meet] unexpected response:", data)
      return null
    }

    // `name` is "spaces/{spaceId}" -- extract the ID.
    const spaceId = data.name.split("/").pop() ?? ""

    return { meetUri: data.meetingUri, spaceId }
  } catch (err) {
    console.error("[google-meet] createMeetLink error:", err)
    return null
  }
}
