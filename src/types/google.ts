export interface GoogleAccount {
  name: string
  accountId: string
  accountName: string
  type: string
  role: string
  state: string
}

export interface GoogleLocation {
  name: string
  locationId: string
  displayName: string
  primaryPhone: string
  websiteUrl: string
  category: string
  address: string
  addressComponents: {
    street: string
    city: string
    state: string
    postalCode: string
  }
  placeId: string
  metadata: {
    canReview: boolean
    canUpdateInsights: boolean
  }
  locationState: {
    isGoogleUpdated: boolean
    isGoogleVerified: boolean
  }
}

export interface GoogleReviewer {
  displayName: string
  profilePhotoUrl?: string
  isAnonymous?: boolean
}

export interface GoogleReview {
  reviewId: string
  reviewer: GoogleReviewer
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
  comment: string
  createTime: string
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
  reviewMedia?: Array<{
    mediaUrl: string
    mediaType: string
  }>
}

export interface GoogleReviewsResponse {
  reviews: GoogleReview[]
  averageRating: number
  totalReviewCount: number
  nextPageToken?: string
}

export interface GoogleLocationWithReviews extends GoogleLocation {
  averageRating: number
  totalReviewCount: number
}

export type StarRating = 1 | 2 | 3 | 4 | 5

export function googleStarRatingToNumber(rating: string): StarRating {
  const map: Record<string, StarRating> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  }
  return map[rating] ?? 3
}

export function numberToGoogleStarRating(rating: StarRating): string {
  const map: Record<number, string> = {
    1: "ONE",
    2: "TWO",
    3: "THREE",
    4: "FOUR",
    5: "FIVE",
  }
  return map[rating] ?? "THREE"
}
