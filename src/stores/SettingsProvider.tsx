import { createSignal, onMount, type ParentProps } from "solid-js";
import {
  SettingsContext,
  type SettingsContextValue,
  type SettingsData,
} from "./settings-store";

const EMPTY: SettingsData = {
  placeId: "",
  logo: null,
  businessName: "",
  phone: "",
  address: "",
};

async function fetchBusiness(): Promise<SettingsData> {
  try {
    const res = await fetch("/api/business");
    if (!res.ok) return EMPTY;
    const data = await res.json();
    return {
      placeId: typeof data.placeId === "string" ? data.placeId : "",
      logo: typeof data.logo === "string" ? data.logo : null,
      businessName: typeof data.businessName === "string" ? data.businessName : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      address: typeof data.address === "string" ? data.address : "",
    };
  } catch {
    return EMPTY;
  }
}

export function SettingsProvider(props: ParentProps) {
  const [placeId, setPlaceIdSignal] = createSignal("");
  const [logo, setLogoSignal] = createSignal<string | null>(null);
  const [businessName, setBusinessNameSignal] = createSignal("");
  const [phone, setPhoneSignal] = createSignal("");
  const [address, setAddressSignal] = createSignal("");

  onMount(async () => {
    const initial = await fetchBusiness();
    setPlaceIdSignal(initial.placeId);
    setLogoSignal(initial.logo);
    setBusinessNameSignal(initial.businessName);
    setPhoneSignal(initial.phone);
    setAddressSignal(initial.address);
  });

  const setPlaceId: typeof setPlaceIdSignal = (value) => {
    return setPlaceIdSignal(value);
  };

  const setLogo: typeof setLogoSignal = (value) => {
    return setLogoSignal(value);
  };

  const setBusinessName: typeof setBusinessNameSignal = (value) => {
    return setBusinessNameSignal(value);
  };

  const setPhone: typeof setPhoneSignal = (value) => {
    return setPhoneSignal(value);
  };

  const setAddress: typeof setAddressSignal = (value) => {
    return setAddressSignal(value);
  };

  const value: SettingsContextValue = {
    placeId,
    setPlaceId,
    logo,
    setLogo,
    businessName,
    setBusinessName,
    phone,
    setPhone,
    address,
    setAddress,
  };

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
}
