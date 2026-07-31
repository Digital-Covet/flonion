import type { APIEvent } from "@solidjs/start/server"
import { getValidAccessToken, hasValidTokens } from "~/lib/google-tokens"
import type { GoogleReview, GoogleReviewsResponse } from "~/types/google"

export async function GET(event: APIEvent) {
  if (!hasValidTokens("default")) {
    return Response.json(
      { error: "Not authenticated", authUrl: "/api/google/auth" },
      { status: 401 },
    )
  }

  const url = new URL(event.request.url)
  const accountId = url.searchParams.get("accountId")
  const locationId = url.searchParams.get("locationId")
  const pageToken = url.searchParams.get("pageToken") || undefined
  const pageSize = url.searchParams.get("pageSize") || "50"

  if (!accountId || !locationId) {
    return Response.json(
      { error: "Missing required parameters: accountId and locationId" },
      { status: 400 },
    )
  }

  try {
    const accessToken = await getValidAccessToken("default")

    const parent = `accounts/${accountId}/locations/${locationId}`
    const params = new URLSearchParams({ pageSize })
    if (pageToken) params.set("pageToken", pageToken)

    const reviewResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${parent}/reviews?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (!reviewResponse.ok) {
      const errorData = await reviewResponse.json().catch(() => ({}))
      return Response.json(
        {
          error: "Failed to fetch reviews",
          details: errorData.error?.message || reviewResponse.statusText,
        },
        { status: reviewResponse.status },
      )
    }

    const data: {
      reviews?: GoogleReview[]
      averageRating?: number
      totalReviewCount?: number
      nextPageToken?: string
    } = await reviewResponse.json()

    const response: GoogleReviewsResponse = {
      reviews: data.reviews || [],
      averageRating: data.averageRating || 0,
      totalReviewCount: data.totalReviewCount || 0,
      nextPageToken: data.nextPageToken,
    }

    return Response.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
