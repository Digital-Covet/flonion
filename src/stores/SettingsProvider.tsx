import { createSignal, onMount, type ParentProps } from "solid-js";
import {
  SettingsContext,
  type SettingsContextValue,
  type SettingsData,
} from "./settings-store";

const STORAGE_KEY = "revme-settings";

function loadSettings(): SettingsData {
  if (typeof window === "undefined") {
    return { placeId: "", logo: null, businessName: "", phone: "", address: "" };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return { placeId: "", logo: null, businessName: "", phone: "", address: "" };
    }

    const parsed: unknown = JSON.parse(stored);

    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const placeId = obj.placeId;
      const logo = obj.logo;
      const businessName = obj.businessName;
      const phone = obj.phone;
      const address = obj.address;

      if (typeof placeId === "string") {
        return {
          placeId,
          logo: typeof logo === "string" ? logo : null,
          businessName: typeof businessName === "string" ? businessName : "",
          phone: typeof phone === "string" ? phone : "",
          address: typeof address === "string" ? address : "",
        };
      }
    }
  } catch {
    // Ignore unavailable storage or malformed data.
  }

  return { placeId: "", logo: null, businessName: "", phone: "", address: "" };
}

function saveSettings(data: SettingsData): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Keep the in-memory setting usable when storage is unavailable.
  }
}

export function SettingsProvider(props: ParentProps) {
  const [placeId, setPlaceIdSignal] = createSignal("");
  const [logo, setLogoSignal] = createSignal<string | null>(null);
  const [businessName, setBusinessNameSignal] = createSignal("");
  const [phone, setPhoneSignal] = createSignal("");
  const [address, setAddressSignal] = createSignal("");

  onMount(() => {
    const initial = loadSettings();
    setPlaceIdSignal(initial.placeId);
    setLogoSignal(initial.logo);
    setBusinessNameSignal(initial.businessName);
    setPhoneSignal(initial.phone);
    setAddressSignal(initial.address);
  });

  const setPlaceId: typeof setPlaceIdSignal = (value) => {
    const nextPlaceId = setPlaceIdSignal(value);
    saveSettings({
      placeId: nextPlaceId,
      logo: logo(),
      businessName: businessName(),
      phone: phone(),
      address: address(),
    });
    return nextPlaceId;
  };

  const setLogo: typeof setLogoSignal = (value) => {
    const nextLogo = setLogoSignal(value);
    saveSettings({
      placeId: placeId(),
      logo: nextLogo,
      businessName: businessName(),
      phone: phone(),
      address: address(),
    });
    return nextLogo;
  };

  const setBusinessName: typeof setBusinessNameSignal = (value) => {
    const nextName = setBusinessNameSignal(value);
    saveSettings({
      placeId: placeId(),
      logo: logo(),
      businessName: nextName,
      phone: phone(),
      address: address(),
    });
    return nextName;
  };

  const setPhone: typeof setPhoneSignal = (value) => {
    const nextPhone = setPhoneSignal(value);
    saveSettings({
      placeId: placeId(),
      logo: logo(),
      businessName: businessName(),
      phone: nextPhone,
      address: address(),
    });
    return nextPhone;
  };

  const setAddress: typeof setAddressSignal = (value) => {
    const nextAddress = setAddressSignal(value);
    saveSettings({
      placeId: placeId(),
      logo: logo(),
      businessName: businessName(),
      phone: phone(),
      address: nextAddress,
    });
    return nextAddress;
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
