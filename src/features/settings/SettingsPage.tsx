import { createSignal, onMount, Show } from "solid-js";
import {
  Building2,
  Puzzle,
  SlidersHorizontal,
  Store,
  Save,
  Zap,
} from "lucide-solid";
import { SectionCard } from "./components/SectionCard";
import { FormField } from "./components/FormField";
import { ToggleRow } from "./components/ToggleRow";
import { IntegrationCard } from "./components/IntegrationCard";
import { LogoUploader } from "./components/LogoUploader";
import { useSettings } from "~/stores/settings-store";
import type { IntegrationData, GoogleLocationData } from "./types";

const googleBusinessIntegration: IntegrationData = {
  name: "Google Business Profile",
  connectedSince: "Oct 2023",
  icon: Store,
  iconColor: "#4285F4",
};

export function SettingsPage() {
  const {
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
  } = useSettings();

  const [connected, setConnected] = createSignal(false);
  const [connecting, setConnecting] = createSignal(false);
  const [locations, setLocations] = createSignal<GoogleLocationData[]>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = createSignal<
    number | undefined
  >(undefined);
  const [locationsError, setLocationsError] = createSignal("");
  const [locationsErrorHint, setLocationsErrorHint] = createSignal("");

  const [emailNotifications, setEmailNotifications] = createSignal(true);
  const [aiSuggestions, setAiSuggestions] = createSignal(true);
  const [saving, setSaving] = createSignal(false);

  const checkConnection = async () => {
    try {
      setLocationsError("");
      setLocationsErrorHint("");
      const res = await fetch("/api/google/locations");
      const data = await res.json();

      if (!res.ok) {
        setLocationsError(data.error || "Failed to load business locations");
        setLocationsErrorHint(data.hint || "");
        return;
      }

      if (data.accounts) {
        setConnected(true);

        const allLocations: GoogleLocationData[] = [];
        for (const account of data.accounts) {
          for (const loc of account.locations ?? []) {
            allLocations.push({
              displayName: loc.displayName ?? "",
              address: loc.address ?? "",
              primaryPhone: loc.primaryPhone ?? "",
              websiteUrl: loc.websiteUrl ?? "",
              category: loc.category ?? "",
              placeId: loc.placeId ?? "",
            });
          }
        }
        setLocations(allLocations);
      }
    } catch {
      // Not connected or error -- stay disconnected
    }
  };

  onMount(() => {
    checkConnection();

    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnected(true);
      checkConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  const handleConnect = () => {
    setConnecting(true);
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/google/auth?returnTo=${returnTo}`;
  };

  const handleLocationSelect = (index: number) => {
    setSelectedLocationIndex(index);
    const loc = locations()[index];
    if (!loc) return;

    if (loc.placeId) setPlaceId(loc.placeId);
    if (loc.displayName) setBusinessName(loc.displayName);
    if (loc.primaryPhone) setPhone(loc.primaryPhone);
    if (loc.address) setAddress(loc.address);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 200);
  };

  return (
    <main class="flex-1 overflow-y-auto px-6 py-8">
      <div class="mx-auto max-w-4xl space-y-8">
        <div class="mb-8">
          <h2 class="text-2xl font-semibold leading-10 tracking-tight text-foreground">
            Settings
          </h2>
          <p class="mt-1 text-lg leading-6 text-muted-foreground">
            Manage your business profile and platform preferences.
          </p>
        </div>

        <SectionCard title="Business Profile" icon={Building2}>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="md:col-span-2">
              <LogoUploader
                logo={logo()}
                onChange={setLogo}
                businessName={businessName()}
              />
            </div>
            <FormField
              id="business-name"
              label="Business Name"
              value={businessName()}
              onInput={(e) =>
                setBusinessName((e.target as HTMLInputElement).value)
              }
            />
            <FormField
              id="phone-number"
              label="Phone Number"
              type="tel"
              value={phone()}
              onInput={(e) =>
                setPhone((e.target as HTMLInputElement).value)
              }
            />
            <FormField
              id="address"
              label="Address"
              value={address()}
              onInput={(e) =>
                setAddress((e.target as HTMLInputElement).value)
              }
              class="md:col-span-2"
            />
            <FormField
              id="place-id"
              label="Google Place ID"
              value={placeId()}
              placeholder="ChIJ..."
              hint="Auto-filled from Google Business Profile, or enter manually"
              onInput={(e) =>
                setPlaceId((e.target as HTMLInputElement).value)
              }
              class="md:col-span-2"
            />
          </div>
        </SectionCard>

        <SectionCard title="Integrations" icon={Puzzle} showAiBadge>
          <IntegrationCard
            integration={googleBusinessIntegration}
            placeId={placeId()}
            onPlaceIdInput={(e) =>
              setPlaceId((e.target as HTMLInputElement).value)
            }
            connected={connected()}
            connecting={connecting()}
            locations={locations()}
            selectedLocationIndex={selectedLocationIndex()}
            onConnect={handleConnect}
            onLocationSelect={handleLocationSelect}
            error={locationsError()}
            errorHint={locationsErrorHint()}
          />
        </SectionCard>

        <SectionCard title="Platform Preferences" icon={SlidersHorizontal}>
          <div class="space-y-0">
            <ToggleRow
              id="toggle-email-notifications"
              label="Email Notifications"
              description="Receive daily digests of business performance."
              checked={emailNotifications()}
              onChange={setEmailNotifications}
            />
            <ToggleRow
              id="toggle-ai-suggestions"
              label="AI Suggestion Engine"
              description="Allow AI to recommend SEO improvements based on trends."
              checked={aiSuggestions()}
              onChange={setAiSuggestions}
              badgeIcon={Zap}
            />
          </div>
        </SectionCard>

        <div class="flex justify-end gap-4 pt-6">
          <button
            type="button"
            class="h-10 rounded-lg border border-border px-6 text-sm font-medium leading-normal text-muted-foreground transition-colors hover:bg-muted"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            class="flex h-10 items-center gap-1 rounded-lg bg-teal-50 px-6 text-sm font-medium leading-normal text-teal-700 shadow-md transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:scale-95 disabled:opacity-70"
            disabled={saving()}
          >
            <Save size={18} />
            {saving() ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}
