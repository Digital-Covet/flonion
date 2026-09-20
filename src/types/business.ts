export type TeamMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The business the signed-in user works in, as every page in the signed-in app
 * reads it. Served by `getBusiness()` (and, for any remaining client caller,
 * by `GET /api/business`) — both go through `loadBusinessInfo`.
 */
export type BusinessInfo = {
  currentUserId: string;
  /** The owner of the business, which is not necessarily the current user. */
  ownerId: string | null;
  businessId: string;
  isOwner: boolean;
  role: string;
  placeId: string;
  reviewLink: string;
  reviewLinks: Record<string, string>;
  logo: string | null;
  businessName: string;
  username: string;
  phone: string;
  address: string;
  sector: string;
  keywords: string;
  description: string;
  rating: number;
  reviewCount: number;
  onboardingCompleted: boolean;
  teamMembers: TeamMember[];
};
