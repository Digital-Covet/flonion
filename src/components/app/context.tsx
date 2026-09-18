import {
  createContext,
  createResource,
  createSignal,
  type JSX,
  onMount,
  type Resource,
  useContext,
} from "solid-js";
import { api } from "~/components/onboarding/ui";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/** Shape of GET /api/business (see src/routes/api/business.ts). */
export type BusinessInfo = {
  currentUserId: string;
  businessId: string;
  isOwner: boolean;
  role: string;
  placeId: string;
  reviewLink: string;
  reviewLinks: Record<string, string>;
  logo: string | null;
  businessName: string;
  username: string;
  phone: string;
  address: string;
  sector: string;
  keywords: string;
  description: string;
  rating: number;
  reviewCount: number;
  teamMembers: TeamMember[];
};

type AppContextValue = {
  business: Resource<BusinessInfo>;
  refetchBusiness: () => void;
};

const AppContext = createContext<AppContextValue>();

async function loadBusiness(): Promise<BusinessInfo> {
  const res = await api<BusinessInfo>("/api/business");
  if (res.status === 401) {
    window.location.assign(
      `/login?callbackURL=${encodeURIComponent(window.location.pathname)}`,
    );
  }
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load business");
  return res.data as BusinessInfo;
}

/**
 * Loads the business once for the whole app shell. Fetching starts after
 * mount: API routes need the browser's cookies, so nothing runs during SSR.
 */
export function AppProvider(props: { children: JSX.Element }) {
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  const [business, { refetch }] = createResource(ready, loadBusiness);

  return (
    <AppContext.Provider value={{ business, refetchBusiness: refetch }}>
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
