# Directory Structure
```
src/stores/SettingsProvider.tsx
```

# Files

## File: src/stores/SettingsProvider.tsx
```typescript
import { createSignal, type ParentProps } from "solid-js";
import {
  SettingsContext,
  type SettingsContextValue,
  type SettingsData,
} from "./settings-store";
const STORAGE_KEY = "revme-settings";
function loadSettings(): SettingsData {
  if (typeof window === "undefined") {
    return { placeId: "", logo: null, businessName: "" };
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { placeId: "", logo: null, businessName: "" };
    }
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const placeId = obj.placeId;
      const logo = obj.logo;
      const businessName = obj.businessName;
      if (typeof placeId === "string") {
        return {
          placeId,
          logo: typeof logo === "string" ? logo : null,
          businessName: typeof businessName === "string" ? businessName : "",
        };
      }
    }
  } catch {
    // Ignore unavailable storage or malformed data.
  }
  return { placeId: "", logo: null, businessName: "" };
}
function saveSettings(data: SettingsData): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
  }
}
export function SettingsProvider(props: ParentProps) {
  const initial = loadSettings();
  const [placeId, setPlaceIdSignal] = createSignal(initial.placeId);
  const [logo, setLogoSignal] = createSignal<string | null>(initial.logo);
  const [businessName, setBusinessNameSignal] = createSignal(initial.businessName);
  const setPlaceId: typeof setPlaceIdSignal = (value) => {
    const nextPlaceId = setPlaceIdSignal(value);
    saveSettings({ placeId: nextPlaceId, logo: logo(), businessName: businessName() });
    return nextPlaceId;
  };
  const setLogo: typeof setLogoSignal = (value) => {
    const nextLogo = setLogoSignal(value);
    saveSettings({ placeId: placeId(), logo: nextLogo, businessName: businessName() });
    return nextLogo;
  };
  const setBusinessName: typeof setBusinessNameSignal = (value) => {
    const nextName = setBusinessNameSignal(value);
    saveSettings({ placeId: placeId(), logo: logo(), businessName: nextName });
    return nextName;
  };
  const value: SettingsContextValue = {
    placeId,
    setPlaceId,
    logo,
    setLogo,
    businessName,
    setBusinessName,
  };
  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
}
```
