/**
 * Marketplace shapes shared by the server query (`~/lib/partners-query`) and
 * the browser.
 *
 * Types and plain constants only: the marketplace page imports this module, so
 * anything added here ships to the client. Never import `~/db/prisma` from it.
 */

export type SortKey = "rating" | "relevance" | "alpha-asc" | "alpha-desc";

export const SORT_OPTIONS = [
  { value: "rating", label: "Highest rated" },
  { value: "relevance", label: "Most reviewed" },
  { value: "alpha-asc", label: "Name A–Z" },
  { value: "alpha-desc", label: "Name Z–A" },
] as const satisfies ReadonlyArray<{ value: SortKey; label: string }>;

/** One marketplace card, as `GET /api/marketplace/partners` returns it. */
export interface Partner {
  id: string;
  /** First letter of the name, used when the partner has no logo. */
  initial: string;
  name: string;
  username: string | null;
  logo: string | null;
  rating: number;
  reviewCount: number;
  description: string;
  category?: string;
  location: string | null;
  phone: string | null;
  tags: string[];
  /** Created inside the new-arrival window (30 days). */
  isNew: boolean;
  buttonType: "meeting" | "request";
}

export interface PartnersQuery {
  categories: string[];
  search: string;
  minRating: number | null;
  maxRating: number | null;
  sort: SortKey;
  page: number;
  pageSize: number;
}

export interface PartnersResult {
  partners: Partner[];
  totalCount: number;
  page: number;
  pageSize: number;
  /** Every category the filter panel can offer, in display order. */
  categories: string[];
}
