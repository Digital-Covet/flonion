import type { APIEvent } from "@solidjs/start/server"
import { getValidAccessToken, hasValidTokens } from "~/lib/google-tokens"
import { getSessionFromHeaders } from "~/lib/server-auth"
import type { GoogleAccount, GoogleLocation } from "~/types/google"

interface RawLocation {
  name?: string
  locationId?: string
  displayName?: string
  title?: string
  primaryPhone?: string
  primaryCategory?: { displayName?: string }
  websiteUrl?: string
  storefrontAddress?: {
    addressLines?: string[]
    locality?: string
    administrativeArea?: string
    postalCode?: string
    regionCode?: string
  }
  metadata?: {
    canReview?: boolean
    canUpdateInsights?: boolean
  }
  locationState?: {
    isGoogleUpdated?: boolean
    isGoogleVerified?: boolean
  }
  locationKey?: {
    placeId?: string
    plusPageId?: string
  }
}

function mapLocation(raw: RawLocation): GoogleLocation {
  const addr = raw.storefrontAddress
  const addressLine = addr?.addressLines?.join(", ") ?? ""
  const cityLocality = addr?.locality ?? ""
  const stateRegion = addr?.administrativeArea ?? ""
  const postal = addr?.postalCode ?? ""

  const parts = [addressLine, cityLocality, stateRegion, postal].filter(Boolean)
  const fullAddress = parts.join(", ")

  return {
    name: raw.name ?? "",
    locationId: raw.locationId ?? "",
    displayName: raw.displayName ?? raw.title ?? "",
    primaryPhone: raw.primaryPhone ?? "",
    websiteUrl: raw.websiteUrl ?? "",
    category: raw.primaryCategory?.displayName ?? "",
    address: fullAddress,
    addressComponents: {
      street: addressLine,
      city: cityLocality,
      state: stateRegion,
      postalCode: postal,
    },
    placeId: raw.locationKey?.placeId ?? "",
    metadata: {
      canReview: raw.metadata?.canReview ?? false,
      canUpdateInsights: raw.metadata?.canUpdateInsights ?? false,
    },
    locationState: {
      isGoogleUpdated: raw.locationState?.isGoogleUpdated ?? false,
      isGoogleVerified: raw.locationState?.isGoogleVerified ?? false,
    },
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  baseDelay = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : baseDelay * Math.pow(2, attempt)

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
    }

    return response
  }

  throw new Error("Max retries exceeded")
}

export async function GET(_event: APIEvent) {
  const session = await getSessionFromHeaders(_event.request.headers)
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  if (!hasValidTokens("default")) {
    return Response.json(
      { error: "Not authenticated", authUrl: "/api/google/auth" },
      { status: 401 },
    )
  }

  try {
    const accessToken = await getValidAccessToken("default")

    const accountsResponse = await fetchWithRetry(
      "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json().catch(() => ({}))
      const message = errorData.error?.message || accountsResponse.statusText
      const isQuota = accountsResponse.status === 429 || message.includes("Quota exceeded")

      return Response.json(
        {
          error: "Failed to fetch accounts",
          details: message,
          ...(isQuota && {
            hint: "Google Business Profile API quota has been exceeded. Request quota increase at https://developers.google.com/my-business/content/prereqs",
          }),
        },
        { status: accountsResponse.status },
      )
    }

    const accountsData = await accountsResponse.json()
    const accounts: GoogleAccount[] = accountsData.accounts || []

    const allLocations: Array<GoogleAccount & { locations: GoogleLocation[] }> = []

    for (const account of accounts) {
      const locationsResponse = await fetchWithRetry(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json()
        const rawLocations: RawLocation[] = locationsData.locations || []
        allLocations.push({
          ...account,
          locations: rawLocations.map(mapLocation),
        })
      }
    }

    return Response.json({ accounts: allLocations })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
