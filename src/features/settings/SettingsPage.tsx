import { TagsInput } from "@ark-ui/solid/tags-input";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Building2 from "lucide-solid/icons/building-2";
import CircleHelp from "lucide-solid/icons/circle-help";
import ExternalLink from "lucide-solid/icons/external-link";
import Link2 from "lucide-solid/icons/link-2";
import Plus from "lucide-solid/icons/plus";
import Puzzle from "lucide-solid/icons/puzzle";
import Save from "lucide-solid/icons/save";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import Tags from "lucide-solid/icons/tags";
import X from "lucide-solid/icons/x";
import Zap from "lucide-solid/icons/zap";
import { createSignal, For, Index, onMount, Show } from "solid-js";
import { SectorSelect, sectors } from "~/components/onboarding/SectorSelect";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import { useSettings } from "~/stores/settings-store";
import { DisconnectConfirmModal } from "./components/DisconnectConfirmModal";
import { FormField } from "./components/FormField";
import { GoogleBusinessCard } from "./components/GoogleBusinessCard";
import { GoogleMeetCard } from "./components/GoogleMeetCard";
import { LogoUploader } from "./components/LogoUploader";
import { SectionCard } from "./components/SectionCard";
import { ToggleRow } from "./components/ToggleRow";
import {
  CUSTOM_LABEL_KEY,
  getPlatformBySlug,
  REVIEW_PLATFORMS,
} from "./review-platforms";
import type { GoogleLocationData } from "./types";

export function SettingsPage() {
  const {
    placeId,
    setPlaceId,
    reviewLink,
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
  // Independent spinners per card — connecting one integration must not spin
  // the other. `connected` stays shared: both cards reflect the same stored
  // Google grant (see checkConnection note above).
  const [connectingBusiness, setConnectingBusiness] = createSignal(false);
  const [connectingMeet, setConnectingMeet] = createSignal(false);
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
  // DS §6 loading state: per-widget skeleton until the first fetch lands,
  // so the form never flashes empty. One slow widget never blocks others.
  const [ready, setReady] = createSignal(false);
  const [addingPlatform, setAddingPlatform] = createSignal(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = createSignal(false);
  const [disconnecting, setDisconnecting] = createSignal(false);

  /**
   * Connection state comes from the stored Google grant, not from whether the
   * Business Profile API happens to answer. Those are different questions: a
   * project without Business Profile API quota returns a permanent 429, which
   * previously made a connected owner look disconnected on every visit.
   */
  const checkConnection = async () => {
    try {
      const res = await fetch("/api/google/status");
      if (res.ok) {
        const { connected: isConnected } = await res.json();
        setConnected(Boolean(isConnected));
        if (isConnected) await loadLocations();
        return;
      }
      if (res.status === 401) return; // signed out
    } catch {
      // fall through to the legacy probe below
    }

    // The status endpoint is unavailable (older build, route not registered
    // yet). Fall back to inferring from the locations call so this is never
    // worse than the previous behaviour.
    await loadLocations();
  };

  const loadLocations = async () => {
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
      // Leave the locations list empty; connection state is tracked separately.
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (res.ok) {
        setConnected(false);
        setLocations([]);
        setSelectedLocationIndex(undefined);
        setDisconnectModalOpen(false);
        notify("success", "Google disconnected");
      } else {
        notify("error", "Couldn't disconnect Google");
      }
    } catch {
      notify("error", "Couldn't disconnect Google");
    } finally {
      setDisconnecting(false);
    }
  };

  onMount(() => {
    refetch().finally(() => setReady(true));
    checkConnection();

    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnected(true);
      checkConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  const handleConnect = (which: "business" | "meet") => {
    if (which === "business") setConnectingBusiness(true);
    else setConnectingMeet(true);
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
    sectors.includes(sector()) ? sector() : sector() ? "Other" : "";

  const customSectorValue = () => (sectors.includes(sector()) ? "" : sector());

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
        const msg =
          data?.error ?? "Couldn't save your changes. Please try again.";
        setSaveError(msg);
        notify("error", msg);
        return;
      }

      setSaveSuccess(true);
      notify("success", "Settings saved");
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setSaveError("Couldn't save your changes. Please try again.");
      notify("error", "Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    await refetch();
    setSaveError("");
    notify("success", "Changes discarded");
  };

  // Section ids mirror SETTINGS_NAV in ./components/SettingsShell — the shell
  // owns the H1, the sticky desktop nav, and the mobile quick-link chips.
  // This component renders the section content only.
  return (
    <div class="e1-enter space-y-6 sm:space-y-8">
      <Show
        when={ready()}
        fallback={
          <div
            class="grid gap-2 rounded-card border border-border bg-card p-6"
            role="status"
            aria-label="Loading settings"
          >
            <Skeleton class="h-6 w-48" />
            <Skeleton class="h-24 w-full" />
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton class="h-10 w-full" />
              <Skeleton class="h-10 w-full" />
              <Skeleton class="h-10 w-full md:col-span-2" />
            </div>
          </div>
        }
      >
        <SectionCard
          id="section-profile"
          title="Business Profile"
          icon={Building2}
        >
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
                  setUsername(
                    (e.target as HTMLInputElement).value.toLowerCase(),
                  )
                }
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Your review link: /company/{username() || "username"}
              </p>
            </div>
            <FormField
              id="phone-number"
              label="Phone Number"
              type="tel"
              value={phone()}
              onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            />
            <FormField
              id="address"
              label="Address"
              value={address()}
              onInput={(e) => setAddress((e.target as HTMLInputElement).value)}
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
      </Show>

      <SectionCard
        id="section-integrations"
        title="Integrations"
        icon={Puzzle}
        showAiBadge
      >
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GoogleBusinessCard
            placeId={placeId()}
            onPlaceIdInput={(e) =>
              setPlaceId((e.target as HTMLInputElement).value)
            }
            connected={connected()}
            connecting={connectingBusiness()}
            locations={locations()}
            selectedLocationIndex={selectedLocationIndex()}
            onConnect={() => handleConnect("business")}
            onRequestDisconnect={() => setDisconnectModalOpen(true)}
            onLocationSelect={handleLocationSelect}
            error={locationsError()}
            errorHint={locationsErrorHint()}
          />
          <GoogleMeetCard
            connected={connected()}
            connecting={connectingMeet()}
            onConnect={() => handleConnect("meet")}
            onRequestDisconnect={() => setDisconnectModalOpen(true)}
          />
        </div>
      </SectionCard>

      <SectionCard id="section-review-links" title="Review Links" icon={Link2}>
        <p class="mb-4 text-sm text-muted-foreground">
          Add review links for each platform. Customers will be directed to
          these links after submitting their feedback.
        </p>

        <a
          href="https://docs.flonion.com/guides/add-review-links/"
          target="_blank"
          rel="noopener noreferrer"
          class="mb-4 flex items-center gap-2 rounded-card border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <CircleHelp size={16} class="shrink-0" />
          <span>
            Not sure how to get your review URL? Check the step-by-step guide.
          </span>
          <ExternalLink size={12} class="ml-auto shrink-0" />
        </a>

        <div class="space-y-4">
          <For each={enabledPlatforms()}>
            {(slug) => {
              const platform = getPlatformBySlug(slug);
              if (!platform) return null;
              return (
                <div class="flex items-start gap-3">
                  <div
                    class="mt-2.5 flex size-8 shrink-0 items-center justify-center rounded-control text-xs font-medium text-white"
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
                            [CUSTOM_LABEL_KEY]: (e.target as HTMLInputElement)
                              .value,
                          }))
                        }
                      />
                    </Show>
                    <FormField
                      id={`review-link-${slug}`}
                      label={
                        platform.isCustom && reviewLinks()[CUSTOM_LABEL_KEY]
                          ? reviewLinks()[CUSTOM_LABEL_KEY]
                          : `${platform.label} Review Link`
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
                    class="mt-8 rounded-control p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
                  class="inline-flex items-center gap-1.5 rounded-control border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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

      <SectionCard
        id="section-preferences"
        title="Platform Preferences"
        icon={SlidersHorizontal}
      >
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

      <SectionCard id="section-keywords" title="Review Keywords" icon={Tags}>
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
                <TagsInput.Control class="flex min-h-11 flex-wrap items-center gap-2 rounded-control border border-border bg-card px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
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

      {/* Sticky save bar (DS §4 Toast & Save Confirmation): everyday saves
            stay in this bar; destructive disconnect lives in the Danger Zone
            below and always asks for confirmation first. */}
      <Show
        when={isOwner()}
        fallback={
          <p class="pt-2 text-right text-sm text-muted-foreground">
            Only the business owner can change these details.
          </p>
        }
      >
        <div
          class="sticky bottom-4 flex flex-col gap-3 rounded-card border border-border bg-card/95 p-4 shadow-md backdrop-blur sm:flex-row sm:items-center"
          aria-live="polite"
        >
          <Show
            when={saveError()}
            fallback={
              <p class="min-w-0 flex-1 text-sm text-muted-foreground">
                {saveSuccess()
                  ? "All changes saved."
                  : "Review your changes, then save."}
              </p>
            }
          >
            <p role="alert" class="min-w-0 flex-1 text-sm text-destructive">
              {saveError()}
            </p>
          </Show>
          <div class="flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              class="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-6 text-sm font-medium leading-normal text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
            >
              Discard
            </button>
            <Button
              onClick={handleSave}
              loading={saving()}
              loadingLabel="Saving…"
            >
              <Save size={18} aria-hidden="true" />
              {saveSuccess() ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Show>

      {/* Danger zone: destructive integration actions live here, separated
            and confirmed — never beside everyday save controls. */}
      <SectionCard id="section-danger" title="Danger Zone" icon={AlertTriangle}>
        <div class="flex flex-col gap-3 rounded-card border border-destructive/25 bg-destructive-muted p-4 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-medium text-foreground">
              Disconnect Google
            </h3>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Revokes your Google grant: review sync, reply publishing, and Meet
              links stop working until you reconnect.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setDisconnectModalOpen(true)}
            disabled={!connected()}
          >
            Disconnect
          </Button>
        </div>
        <Show when={!connected()}>
          <p class="mt-3 text-sm text-muted-foreground">
            Google is not connected. Nothing to disconnect.
          </p>
        </Show>
      </SectionCard>

      <DisconnectConfirmModal
        isOpen={disconnectModalOpen()}
        loading={disconnecting()}
        onConfirm={handleDisconnect}
        onClose={() => setDisconnectModalOpen(false)}
      />
    </div>
  );
}
