import { createSignal, For, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import { ExternalLink, CheckCircle, Loader2 } from "lucide-solid";
import type { IntegrationData, GoogleLocationData } from "../types";

interface IntegrationCardProps {
  integration: IntegrationData;
  placeId?: string;
  onPlaceIdInput?: (e: InputEvent) => void;
  connected?: boolean;
  connecting?: boolean;
  locations?: GoogleLocationData[];
  selectedLocationIndex?: number;
  onConnect?: () => void;
  onLocationSelect?: (index: number) => void;
  error?: string;
  errorHint?: string;
}

export function IntegrationCard(props: IntegrationCardProps) {
  const [showDetails, setShowDetails] = createSignal(false);

  return (
    <div class="rounded-xl border border-border bg-background p-4">
      <div class="mb-4 flex items-center gap-4">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ "background-color": props.integration.iconColor ?? "#4285F4" }}
        >
          <props.integration.icon size={20} class="text-white" />
        </div>
        <div class="flex-1">
          <p class="text-sm leading-5 font-bold">{props.integration.name}</p>
          <p class="text-xs leading-4 text-muted-foreground">
            {props.connected
              ? `Connected since ${props.integration.connectedSince}`
              : "Not connected"}
          </p>
        </div>
        <Show when={props.connected}>
          <CheckCircle size={18} class="text-green-500" />
        </Show>
      </div>

      <Show when={props.error}>
        <div class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-4 text-red-700">
          <p class="font-medium">{props.error}</p>
          <Show when={props.errorHint}>
            <p class="mt-1">{props.errorHint}</p>
          </Show>
        </div>
      </Show>

      <Show
        when={props.connected}
        fallback={
          <button
            type="button"
            onClick={props.onConnect}
            disabled={props.connecting}
            class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium leading-5 text-foreground transition-all hover:bg-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <Show
              when={!props.connecting}
              fallback={<Loader2 size={16} class="animate-spin" />}
            />
            {props.connecting ? "Connecting..." : "Connect Google Business Profile"}
            <Show when={!props.connecting}>
              <ExternalLink size={14} class="text-muted-foreground" />
            </Show>
          </button>
        }
      >
        <div class="space-y-3">
          <Show when={(props.locations?.length ?? 0) > 0}>
            <div>
              <label
                for="gmb-location-select"
                class="mb-1 block text-sm leading-5 font-medium text-muted-foreground"
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
                class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>
                  Choose a location...
                </option>
                <For each={props.locations}>
                  {(loc, idx) => (
                    <option value={idx()}>
                      {loc.displayName}
                      {loc.address ? ` - ${loc.address}` : ""}
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          <Show when={props.placeId}>
            <Field.Root>
              <Field.Label class="text-sm leading-5 font-medium text-muted-foreground">
                Google Place ID
              </Field.Label>
              <Field.Input
                id="google-place-id"
                value={props.placeId}
                placeholder="ChIJaV_Z..."
                onInput={props.onPlaceIdInput}
                class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Field.HelperText class="text-xs leading-4 italic text-muted-foreground">
                Auto-filled from Google Business Profile. Edit to override.
              </Field.HelperText>
            </Field.Root>
          </Show>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails())}
            class="text-xs leading-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails() ? "Hide details" : "Show connection details"}
          </button>

          <Show when={showDetails()}>
            <div class="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-4 text-muted-foreground space-y-1">
              <p>Account: {props.integration.name}</p>
              <p>Locations found: {props.locations?.length ?? 0}</p>
              <p>Place ID: {props.placeId || "Not set"}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
