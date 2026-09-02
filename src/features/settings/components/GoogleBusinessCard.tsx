import { createSignal, For, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import Store from "lucide-solid/icons/store";
import ExternalLink from "lucide-solid/icons/external-link";
import CheckCircle2 from "lucide-solid/icons/check-circle-2";
import Loader2 from "lucide-solid/icons/loader-2";
import Unlink from "lucide-solid/icons/unlink";
import type { GoogleLocationData } from "../types";

interface GoogleBusinessCardProps {
  placeId?: string;
  onPlaceIdInput?: (e: InputEvent) => void;
  connected?: boolean;
  connecting?: boolean;
  locations?: GoogleLocationData[];
  selectedLocationIndex?: number;
  onConnect?: () => void;
  onRequestDisconnect?: () => void;
  onLocationSelect?: (index: number) => void;
  error?: string;
  errorHint?: string;
}

export function GoogleBusinessCard(props: GoogleBusinessCardProps) {
  const [showDetails, setShowDetails] = createSignal(false);

  return (
    <div class="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/80">
      <div>
        {/* Header */}
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4285F4]/10 text-[#4285F4] shadow-xs">
              <Store size={22} />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-base font-semibold text-foreground">
                  Google Business Profile
                </h4>
                <Show when={props.connected}>
                  <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} />
                    Connected
                  </span>
                </Show>
              </div>
              <p class="text-xs text-muted-foreground">
                {props.connected
                  ? "Sync reviews, ratings, and business location."
                  : "Connect to manage reviews and business information."}
              </p>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        <Show when={props.error}>
          <div class="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs leading-4 text-destructive">
            <p class="font-medium">{props.error}</p>
            <Show when={props.errorHint}>
              <p class="mt-1 opacity-90">{props.errorHint}</p>
            </Show>
          </div>
        </Show>

        {/* Connected State Controls */}
        <Show
          when={props.connected}
          fallback={
            <div class="my-3 space-y-3">
              <p class="text-xs leading-relaxed text-muted-foreground">
                Connecting your Google Business Profile imports your official location,
                enables automated Google review sync, and powers review redirect links.
              </p>
              <button
                type="button"
                onClick={props.onConnect}
                disabled={props.connecting}
                class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-all hover:bg-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                {props.connecting ? (
                  <>
                    <Loader2 size={16} class="animate-spin text-primary" />
                    <span>Connecting Google...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Business Profile</span>
                    <ExternalLink size={14} class="text-muted-foreground" />
                  </>
                )}
              </button>
            </div>
          }
        >
          <div class="space-y-3.5">
            {/* Location Selector */}
            <Show when={(props.locations?.length ?? 0) > 0}>
              <div>
                <label
                  for="gmb-location-select"
                  class="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Select Business Location
                </label>
                <select
                  id="gmb-location-select"
                  value={props.selectedLocationIndex ?? ""}
                  onChange={(e) => {
                    const idx = parseInt(e.currentTarget.value, 10);
                    if (!isNaN(idx)) {
                      props.onLocationSelect?.(idx);
                    }
                  }}
                  class="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>
                    Choose a location...
                  </option>
                  <For each={props.locations}>
                    {(loc, idx) => (
                      <option value={idx()}>
                        {loc.displayName}
                        {loc.address ? ` — ${loc.address}` : ""}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>

            {/* Google Place ID */}
            <Show when={props.placeId !== undefined}>
              <Field.Root>
                <Field.Label class="text-xs font-medium text-muted-foreground">
                  Google Place ID
                </Field.Label>
                <Field.Input
                  id="google-place-id"
                  value={props.placeId}
                  placeholder="ChIJaV_Z..."
                  onInput={props.onPlaceIdInput}
                  class="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <Field.HelperText class="mt-1 text-[11px] leading-4 text-muted-foreground/80">
                  Auto-populated from Google Business Profile. Editable for manual overrides.
                </Field.HelperText>
              </Field.Root>
            </Show>

            {/* Connection Details Drawer */}
            <div class="pt-1">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails())}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                {showDetails() ? "Hide connection details" : "Show connection details"}
              </button>

              <Show when={showDetails()}>
                <div class="mt-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1 font-mono">
                  <p>Locations found: {props.locations?.length ?? 0}</p>
                  <p>Place ID: {props.placeId || "Not set"}</p>
                  <p>Status: Active Sync</p>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Disconnect Footer */}
      <Show when={props.connected}>
        <div class="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <span class="text-xs text-muted-foreground">
            Google Account Linked
          </span>
          <button
            type="button"
            onClick={props.onRequestDisconnect}
            class="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            <Unlink size={13} />
            Disconnect
          </button>
        </div>
      </Show>
    </div>
  );
}
