import { createContext, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { ReviewLinksMap } from "~/features/settings/review-platforms";

export interface SettingsData {
  placeId: string;
  reviewLink: string;
  reviewLinks: ReviewLinksMap;
  logo: string | null;
  businessName: string;
  username: string;
  phone: string;
  address: string;
  sector: string;
  keywords: string;
  description: string;
}

export interface SettingsContextValue {
  placeId: Accessor<string>;
  setPlaceId: Setter<string>;
  reviewLink: Accessor<string>;
  setReviewLink: Setter<string>;
  reviewLinks: Accessor<ReviewLinksMap>;
  setReviewLinks: Setter<ReviewLinksMap>;
  logo: Accessor<string | null>;
  setLogo: Setter<string | null>;
  businessName: Accessor<string>;
  setBusinessName: Setter<string>;
  username: Accessor<string>;
  setUsername: Setter<string>;
  phone: Accessor<string>;
  setPhone: Setter<string>;
  address: Accessor<string>;
  setAddress: Setter<string>;
  sector: Accessor<string>;
  setSector: Setter<string>;
  keywords: Accessor<string>;
  setKeywords: Setter<string>;
  description: Accessor<string>;
  setDescription: Setter<string>;
  /** Only the business owner may edit the business profile. */
  isOwner: Accessor<boolean>;
  refetch: () => Promise<SettingsData>;
  updateSettings: (data: Partial<SettingsData>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>();

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
