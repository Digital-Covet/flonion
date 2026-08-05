import { createSignal, onMount, type Component } from "solid-js";
import ArrowRight from "lucide-solid/icons/arrow-right";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import Store from "lucide-solid/icons/store";
import Check from "lucide-solid/icons/check";

interface PlatformsStepProps {
  onContinue: () => void;
  onBack: () => void;
}

export const PlatformsStep: Component<PlatformsStepProps> = (props) => {
  const [connected, setConnected] = createSignal(false);
  const [connecting, setConnecting] = createSignal(false);

  onMount(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  const handleConnect = () => {
    setConnecting(true);
    const returnTo = encodeURIComponent("/onboarding?step=platforms");
    window.location.href = `/api/google/auth?returnTo=${returnTo}`;
  };

  return (
    <div class="flex flex-col gap-6">
      <div class="rounded-lg border border-border bg-muted/50 p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#4285F4]/10">
            <Store size={24} class="text-[#4285F4]" strokeWidth={2} aria-hidden="true" />
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-foreground">
              Google Business Profile
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              Connect your Google Business Profile to import reviews, reply to customers, and track your online presence.
            </p>

            {connected() ? (
              <div class="mt-3 flex items-center gap-2 text-sm font-medium text-green-600">
                <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                Connected
              </div>
            ) : (
              <button
                type="button"
                class="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                onClick={handleConnect}
                disabled={connecting()}
              >
                {connecting() ? "Connecting..." : "Connect Google"}
              </button>
            )}
          </div>
        </div>
      </div>

      <p class="text-center text-xs text-muted-foreground">
        You can always connect this later from Settings.
      </p>

      <div class="flex items-center justify-between">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          onClick={props.onBack}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          onClick={props.onContinue}
        >
          {connected() ? "Continue" : "Skip for now"}
          <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
