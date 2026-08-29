import { getValidAccessToken, hasValidTokens } from "./google-tokens"

export interface BusinessRating {
  rating: number
  reviewCount: number
}

interface RawLocation {
  name?: string
  locationKey?: { placeId?: string }
}

/**
 * Resolves `accounts/{account}/locations/{location}` for a place id.
 *
 * The reviews endpoint is keyed by account + location, but a business only
 * stores its place id, so the account/location list has to be walked to find
 * the matching entry.
 */
async function findLocationParent(
  accessToken: string,
  placeId: string,
): Promise<string | null> {
  const accountsResponse = await fetch(
    "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!accountsResponse.ok) return null

  const accountsData: { accounts?: Array<{ name?: string }> } =
    await accountsResponse.json()

  for (const account of accountsData.accounts ?? []) {
    if (!account.name) continue

    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    if (!locationsResponse.ok) continue

    const locationsData: { locations?: RawLocation[] } =
      await locationsResponse.json()

    const match = locationsData.locations?.find(
      (loc) => loc.locationKey?.placeId === placeId,
    )

    // `name` comes back as "locations/{id}"; the v4 reviews path wants it
    // nested under the account.
    if (match?.name) {
      const locationId = match.name.split("/").pop()
      if (locationId) return `${account.name}/locations/${locationId}`
    }
  }

  return null
}

/**
 * Reads the cached-on-Google aggregate rating for a business location.
 *
 * Returns `null` whenever the rating cannot be determined — no Google
 * connection, no matching location, or an API failure. Callers treat that as
 * "leave the stored values alone" rather than as an error.
 */
export async function fetchBusinessRating(
  userId: string,
  placeId: string,
): Promise<BusinessRating | null> {
  if (!placeId) return null

  try {
    if (!(await hasValidTokens(userId))) return null

    const accessToken = await getValidAccessToken(userId)
    const parent = await findLocationParent(accessToken, placeId)
    if (!parent) return null

    const reviewsResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    if (!reviewsResponse.ok) return null

    const data: { averageRating?: number; totalReviewCount?: number } =
      await reviewsResponse.json()

    if (typeof data.averageRating !== "number") return null

    return {
      rating: data.averageRating,
      reviewCount: data.totalReviewCount ?? 0,
    }
  } catch (err) {
    console.error("[google-business-rating] lookup failed:", err)
    return null
  }
}
