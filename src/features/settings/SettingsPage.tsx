import { createSignal, For, Index, onMount, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { TagsInput } from "@ark-ui/solid/tags-input";
import Building2 from "lucide-solid/icons/building-2";
import Puzzle from "lucide-solid/icons/puzzle";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import Store from "lucide-solid/icons/store";
import Save from "lucide-solid/icons/save";
import Zap from "lucide-solid/icons/zap";
import X from "lucide-solid/icons/x";
import Tags from "lucide-solid/icons/tags";
import Link2 from "lucide-solid/icons/link-2";
import Plus from "lucide-solid/icons/plus";
import Users from "lucide-solid/icons/users";
import ArrowRight from "lucide-solid/icons/arrow-right";
import { SectionCard } from "./components/SectionCard";
import { FormField } from "./components/FormField";
import { ToggleRow } from "./components/ToggleRow";
import { IntegrationCard } from "./components/IntegrationCard";
import { LogoUploader } from "./components/LogoUploader";
import { SectorSelect, sectors } from "~/components/onboarding/SectorSelect";
import { useSettings } from "~/stores/settings-store";
import type { IntegrationData, GoogleLocationData } from "./types";
import {
  REVIEW_PLATFORMS,
  getPlatformBySlug,
  getPlatformLabel,
  CUSTOM_LABEL_KEY,
  type ReviewLinksMap,
} from "./review-platforms";

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
    description,
    setDescription,
    isOwner,
    refetch,
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
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");
  const [addingPlatform, setAddingPlatform] = createSignal(false);

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
    refetch();
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

  const parsedKeywords = () =>
    keywords()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const enabledPlatforms = () => Object.keys(reviewLinks());

  const availablePlatforms = () =>
    REVIEW_PLATFORMS.filter((p) => !(p.slug in reviewLinks()));

  const updateReviewLink = (slug: string, url: string) => {
    setReviewLinks((prev) => ({ ...prev, [slug]: url }));
  };

  const removeReviewLink = (slug: string) => {
    setReviewLinks((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  };

  const addPlatform = (slug: string) => {
    setReviewLinks((prev) => ({ ...prev, [slug]: "" }));
    setAddingPlatform(false);
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

  const selectedSector = () =>
    sectors.includes(sector())
      ? sector()
      : sector()
        ? "Other"
        : "";

  const customSectorValue = () =>
    sectors.includes(sector()) ? "" : sector();

  const handleSectorChange = (value: string) => {
    setSector(value === "Other" ? "Other" : value);
  };

  const handleCustomSectorChange = (value: string) => {
    setSector(value);
  };

  const finalSector = () => {
    const s = sector();
    if (sectors.includes(s)) return s;
    return s === "Other" ? "" : s;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeId(),
          reviewLink: reviewLink(),
          reviewLinks: reviewLinks(),
          logo: logo(),
          businessName: businessName(),
          username: username(),
          phone: phone(),
          address: address(),
          sector: finalSector(),
          keywords: keywords(),
          description: description(),
        }),
      });

      // fetch only rejects on network failure, so a 4xx used to fall straight
      // through to "Saved!" while nothing had been written.
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? "Couldn't save your changes. Please try again.");
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setSaveError("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main class="flex-1 overflow-y-auto px-6 py-8">
      <Title>Settings — Cognitive Enterprise</Title>
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
            <div>
              <FormField
                id="username"
                label="Username"
                value={username()}
                onInput={(e) =>
                  setUsername((e.target as HTMLInputElement).value.toLowerCase())
                }
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Your review link: /company/{username() || "username"}/review/...
              </p>
            </div>
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
              id="business-description"
              label="Business Description"
              value={description()}
              placeholder="What does your business do? This appears on your marketplace card."
              hint="Shown to other businesses in the marketplace. Max 500 characters."
              multiline
              rows={4}
              maxLength={500}
              onInput={(e) =>
                setDescription((e.target as HTMLTextAreaElement).value)
              }
              class="md:col-span-2"
            />
            <div class="md:col-span-2">
              <SectorSelect
                value={selectedSector()}
                customValue={customSectorValue()}
                onChange={handleSectorChange}
                onCustomChange={handleCustomSectorChange}
              />
            </div>
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

        <SectionCard title="Review Links" icon={Link2}>
          <p class="mb-4 text-sm text-muted-foreground">
            Add review links for each platform. Customers will be directed to these
            links after submitting their feedback.
          </p>

          <div class="space-y-4">
            <For each={enabledPlatforms()}>
              {(slug) => {
                const platform = getPlatformBySlug(slug);
                if (!platform) return null;
                return (
                  <div class="flex items-start gap-3">
                    <div
                      class="mt-2.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ "background-color": platform.color }}
                    >
                      {platform.isCustom && reviewLinks()[CUSTOM_LABEL_KEY]
                        ? reviewLinks()[CUSTOM_LABEL_KEY].charAt(0).toUpperCase()
                        : platform.label.charAt(0)}
                    </div>
                    <div class="flex-1 space-y-3">
                      <Show when={platform.isCustom}>
                        <FormField
                          id={`review-link-label-${slug}`}
                          label="Platform Name"
                          value={reviewLinks()[CUSTOM_LABEL_KEY] ?? ""}
                          placeholder="e.g. Sulekha, Amazon, Angi"
                          hint="Give this platform a name"
                          onInput={(e) =>
                            setReviewLinks((prev) => ({
                              ...prev,
                              [CUSTOM_LABEL_KEY]: (
                                e.target as HTMLInputElement
                              ).value,
                            }))
                          }
                        />
                      </Show>
                      <FormField
                        id={`review-link-${slug}`}
                        label={
                          platform.isCustom && reviewLinks()[CUSTOM_LABEL_KEY]
                            ? reviewLinks()[CUSTOM_LABEL_KEY]
                            : platform.label + " Review Link"
                        }
                        value={reviewLinks()[slug] ?? ""}
                        placeholder={platform.placeholder}
                        hint={
                          platform.isCustom
                            ? "URL for this platform's review page"
                            : `URL for ${platform.label} review page`
                        }
                        onInput={(e) =>
                          updateReviewLink(
                            slug,
                            (e.target as HTMLInputElement).value,
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReviewLink(slug)}
                      class="mt-8 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${platform.label} link`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              }}
            </For>
          </div>

          <Show when={availablePlatforms().length > 0}>
            <div class="mt-4">
              <Show
                when={addingPlatform()}
                fallback={
                  <button
                    type="button"
                    onClick={() => setAddingPlatform(true)}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus size={16} />
                    Add platform
                  </button>
                }
              >
                <div class="flex flex-wrap items-center gap-2">
                  <For each={availablePlatforms()}>
                    {(platform) => (
                      <button
                        type="button"
                        onClick={() => addPlatform(platform.slug)}
                        class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <span
                          class="size-2 rounded-full"
                          style={{ "background-color": platform.color }}
                        />
                        {platform.label}
                      </button>
                    )}
                  </For>
                  <button
                    type="button"
                    onClick={() => setAddingPlatform(false)}
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={enabledPlatforms().length === 0}>
            <p class="mt-2 text-xs text-muted-foreground/70">
              No review links configured. Click "Add platform" to get started.
            </p>
          </Show>
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

        <SectionCard title="Team Management" icon={Users}>
          <p class="mb-4 text-sm text-muted-foreground">
            Manage your team members, roles, and invitations.
          </p>
          <a
            href="/settings/team"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
          >
            Manage Team
            <ArrowRight size={16} />
          </a>
        </SectionCard>

        <SectionCard title="Review Keywords" icon={Tags}>
          <p class="mb-3 text-sm text-muted-foreground">
            Add keywords that guide AI suggestions when customers write reviews
            about your business. These help the AI emphasize the topics that
            matter most to you.
          </p>
          <TagsInput.Root
            value={parsedKeywords()}
            onValueChange={(details) => setKeywords(details.value.join(", "))}
            delimiter=","
            blurBehavior="add"
            addOnPaste
            validate={({ inputValue }) => {
              const trimmed = inputValue.trim();
              const existing = parsedKeywords();
              return trimmed !== "" && !existing.includes(trimmed);
            }}
          >
            <TagsInput.Context>
              {(api) => (
                <>
                  <TagsInput.Control class="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <Index each={api().value}>
                      {(keyword, index) => (
                        <TagsInput.Item
                          index={index}
                          value={keyword()}
                          class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
                        >
                          <TagsInput.ItemPreview>
                            <TagsInput.ItemText>{keyword()}</TagsInput.ItemText>
                            <TagsInput.ItemDeleteTrigger class="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive">
                              <X size={12} />
                            </TagsInput.ItemDeleteTrigger>
                          </TagsInput.ItemPreview>
                          <TagsInput.ItemInput />
                        </TagsInput.Item>
                      )}
                    </Index>
                    <TagsInput.Input
                      placeholder={
                        parsedKeywords().length > 0
                          ? "Add another keyword..."
                          : "e.g. customer service, quality, fast delivery"
                      }
                      class="h-8 min-w-40 flex-1 bg-transparent px-2 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    <TagsInput.ClearTrigger class="whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">
                      Clear all
                    </TagsInput.ClearTrigger>
                  </TagsInput.Control>
                </>
              )}
            </TagsInput.Context>
            <TagsInput.HiddenInput />
          </TagsInput.Root>
          <p class="mt-2 text-xs text-muted-foreground">
            Press Enter or comma to add. Click X to remove.
          </p>
        </SectionCard>

        <Show
          when={isOwner()}
          fallback={
            <p class="pt-6 text-right text-sm text-muted-foreground">
              Only the business owner can change these details.
            </p>
          }
        >
          <Show when={saveError()}>
            <p role="alert" class="pt-6 text-right text-sm text-destructive">
              {saveError()}
            </p>
          </Show>

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
              class="flex h-10 items-center gap-1 rounded-lg bg-teal-50 px-6 text-sm font-medium leading-normal text-teal-700 shadow-md transition-all hover:bg-primary hover:text-primary-foreground disabled:scale-95 disabled:opacity-70"
              disabled={saving()}
            >
              <Save size={18} />
              {saving() ? "Saving..." : saveSuccess() ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </Show>
      </div>
    </main>
  );
}
