export interface Partner {
  id: string;
  name: string;
  initial: string;
  category: string;
  location: string | null;
  rating: number;
  reviews: number;
  description: string;
  logo: string | null;
  username: string | null;
  tags: string[];
  isNew: boolean;
  cta: "book" | "shortlist";
  phone: string | null;
  isFavorited: boolean;
}

export type SortKey = "rating" | "relevance" | "alpha-asc" | "alpha-desc";

export interface SortOption {
  value: SortKey;
  label: string;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface RatingRange {
  min: number;
  max: number;
}

export interface PartnerRaw {
  id: string;
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
  isNew: boolean;
  buttonType: "meeting" | "request";
}

export interface PartnersApiResponse {
  partners: PartnerRaw[];
  totalCount: number;
  page: number;
  pageSize: number;
  categories: string[];
}
