import { createContext, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";

export interface SettingsData {
  placeId: string;
  logo: string | null;
  businessName: string;
  phone: string;
  address: string;
}

export interface SettingsContextValue {
  placeId: Accessor<string>;
  setPlaceId: Setter<string>;
  logo: Accessor<string | null>;
  setLogo: Setter<string | null>;
  businessName: Accessor<string>;
  setBusinessName: Setter<string>;
  phone: Accessor<string>;
  setPhone: Setter<string>;
  address: Accessor<string>;
  setAddress: Setter<string>;
}

export const SettingsContext = createContext<SettingsContextValue>();

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
