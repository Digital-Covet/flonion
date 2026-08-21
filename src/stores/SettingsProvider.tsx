import { createSignal, onMount, type ParentProps } from "solid-js";
import {
  SettingsContext,
  type SettingsContextValue,
  type SettingsData,
} from "./settings-store";
import type { ReviewLinksMap } from "~/features/settings/review-platforms";

const EMPTY: SettingsData = {
  placeId: "",
  reviewLink: "",
  reviewLinks: {},
  logo: null,
  businessName: "",
  username: "",
  phone: "",
  address: "",
  sector: "",
  keywords: "",
};

async function fetchBusiness(): Promise<SettingsData> {
  try {
    const res = await fetch("/api/business");
    if (!res.ok) return EMPTY;
    const data = await res.json();
    return {
      placeId: typeof data.placeId === "string" ? data.placeId : "",
      reviewLink: typeof data.reviewLink === "string" ? data.reviewLink : "",
      reviewLinks: typeof data.reviewLinks === "object" && data.reviewLinks !== null
        ? data.reviewLinks
        : {},
      logo: typeof data.logo === "string" ? data.logo : null,
      businessName: typeof data.businessName === "string" ? data.businessName : "",
      username: typeof data.username === "string" ? data.username : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      address: typeof data.address === "string" ? data.address : "",
      sector: typeof data.sector === "string" ? data.sector : "",
      keywords: typeof data.keywords === "string" ? data.keywords : "",
    };
  } catch {
    return EMPTY;
  }
}

export function SettingsProvider(props: ParentProps) {
  const [placeId, setPlaceIdSignal] = createSignal("");
  const [reviewLink, setReviewLinkSignal] = createSignal("");
  const [reviewLinks, setReviewLinksSignal] = createSignal<ReviewLinksMap>({});
  const [logo, setLogoSignal] = createSignal<string | null>(null);
  const [businessName, setBusinessNameSignal] = createSignal("");
  const [username, setUsernameSignal] = createSignal("");
  const [phone, setPhoneSignal] = createSignal("");
  const [address, setAddressSignal] = createSignal("");
  const [sector, setSectorSignal] = createSignal("");
  const [keywords, setKeywordsSignal] = createSignal("");

  const refetch = async (): Promise<SettingsData> => {
    const data = await fetchBusiness();
    setPlaceIdSignal(data.placeId);
    setReviewLinkSignal(data.reviewLink);
    setReviewLinksSignal(data.reviewLinks);
    setLogoSignal(data.logo);
    setBusinessNameSignal(data.businessName);
    setUsernameSignal(data.username);
    setPhoneSignal(data.phone);
    setAddressSignal(data.address);
    setSectorSignal(data.sector);
    setKeywordsSignal(data.keywords);
    return data;
  };

  const updateSettings = (data: Partial<SettingsData>) => {
    if (data.placeId !== undefined) setPlaceIdSignal(data.placeId);
    if (data.reviewLink !== undefined) setReviewLinkSignal(data.reviewLink);
    if (data.reviewLinks !== undefined) setReviewLinksSignal(data.reviewLinks);
    if (data.logo !== undefined) setLogoSignal(data.logo);
    if (data.businessName !== undefined) setBusinessNameSignal(data.businessName);
    if (data.username !== undefined) setUsernameSignal(data.username);
    if (data.phone !== undefined) setPhoneSignal(data.phone);
    if (data.address !== undefined) setAddressSignal(data.address);
    if (data.sector !== undefined) setSectorSignal(data.sector);
    if (data.keywords !== undefined) setKeywordsSignal(data.keywords);
  };

  onMount(async () => {
    await refetch();
  });

  const setPlaceId: typeof setPlaceIdSignal = (value) => {
    return setPlaceIdSignal(value);
  };

  const setReviewLink: typeof setReviewLinkSignal = (value) => {
    return setReviewLinkSignal(value);
  };

  const setReviewLinks: typeof setReviewLinksSignal = (value) => {
    return setReviewLinksSignal(value);
  };

  const setLogo: typeof setLogoSignal = (value) => {
    return setLogoSignal(value);
  };

  const setBusinessName: typeof setBusinessNameSignal = (value) => {
    return setBusinessNameSignal(value);
  };

  const setUsername: typeof setUsernameSignal = (value) => {
    return setUsernameSignal(value);
  };

  const setPhone: typeof setPhoneSignal = (value) => {
    return setPhoneSignal(value);
  };

  const setAddress: typeof setAddressSignal = (value) => {
    return setAddressSignal(value);
  };

  const setSector: typeof setSectorSignal = (value) => {
    return setSectorSignal(value);
  };

  const setKeywords: typeof setKeywordsSignal = (value) => {
    return setKeywordsSignal(value);
  };

  const value: SettingsContextValue = {
    placeId,
    setPlaceId,
    reviewLink,
    setReviewLink,
    reviewLinks,
    setReviewLinks,
    logo,
    setLogo,
    businessName,
    setBusinessName,
    username,
    setUsername,
    phone,
    setPhone,
    address,
    setAddress,
    sector,
    setSector,
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
