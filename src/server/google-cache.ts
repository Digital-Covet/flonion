import { createTtlCache } from "~/server/cache";
import type { GoogleAccount, GoogleLocation } from "~/types/google";

export type AccountWithLocations = GoogleAccount & {
  locations: GoogleLocation[];
};

/**
 * The accounts-and-locations walk behind `GET /api/google/locations`.
 *
 * It is the slowest thing the app does: one request for the account list, then
 * one per account, all against a quota that a Business Profile project has
 * very little of. Every page that shows Google data used to pay for it again,
 * and the only thing standing in the way was a `sessionStorage` entry — per
 * tab, lost on a hard refresh, and worthless for a second device.
 *
 * Listings change on Google's own timescale, so 15 minutes of staleness is
 * unremarkable next to what the walk costs.
 */
export const locationsCache = createTtlCache<AccountWithLocations[]>({
  name: "gbp-locations",
  ttlMs: 15 * 60_000,
  max: 500,
});

/**
 * Whether the grant is live. One cheap DB read, but `loadListing` and
 * `loadGooglePage` each ask independently, so a page load asks two or three
 * times. Short enough that a disconnect is felt almost immediately.
 */
export const connectedCache = createTtlCache<boolean>({
  name: "gbp-connected",
  ttlMs: 30_000,
  max: 500,
});

/**
 * Keyed by user, not by business: `src/lib/google-tokens.ts` stores a grant
 * per user, so two members of one business can resolve the same place id
 * against different Google accounts. Caching per business would let one see
 * the other's listing.
 */
export function invalidateGoogle(userId: string) {
  locationsCache.delete(userId);
  connectedCache.delete(userId);
}
