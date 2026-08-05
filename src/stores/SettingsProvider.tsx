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
  keywords: "",
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
      keywords: typeof data.keywords === "string" ? data.keywords : "",
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
  const [keywords, setKeywordsSignal] = createSignal("");

  const refetch = async (): Promise<SettingsData> => {
    const data = await fetchBusiness();
    setPlaceIdSignal(data.placeId);
    setLogoSignal(data.logo);
    setBusinessNameSignal(data.businessName);
    setPhoneSignal(data.phone);
    setAddressSignal(data.address);
    setKeywordsSignal(data.keywords);
    return data;
  };

  const updateSettings = (data: Partial<SettingsData>) => {
    if (data.placeId !== undefined) setPlaceIdSignal(data.placeId);
    if (data.logo !== undefined) setLogoSignal(data.logo);
    if (data.businessName !== undefined) setBusinessNameSignal(data.businessName);
    if (data.phone !== undefined) setPhoneSignal(data.phone);
    if (data.address !== undefined) setAddressSignal(data.address);
    if (data.keywords !== undefined) setKeywordsSignal(data.keywords);
  };

  onMount(async () => {
    await refetch();
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

  const setKeywords: typeof setKeywordsSignal = (value) => {
    return setKeywordsSignal(value);
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
    keywords,
    setKeywords,
    refetch,
    updateSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
}
