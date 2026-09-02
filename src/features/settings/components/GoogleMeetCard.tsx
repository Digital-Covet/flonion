import { createSignal, Show } from "solid-js";
import Video from "lucide-solid/icons/video";
import ExternalLink from "lucide-solid/icons/external-link";
import CheckCircle2 from "lucide-solid/icons/check-circle-2";
import Loader2 from "lucide-solid/icons/loader-2";
import Copy from "lucide-solid/icons/copy";
import Check from "lucide-solid/icons/check";
import Calendar from "lucide-solid/icons/calendar";
import Users from "lucide-solid/icons/users";
import Sparkles from "lucide-solid/icons/sparkles";
import Unlink from "lucide-solid/icons/unlink";

interface GoogleMeetCardProps {
  connected?: boolean;
  connecting?: boolean;
  onConnect?: () => void;
  onRequestDisconnect?: () => void;
}

export function GoogleMeetCard(props: GoogleMeetCardProps) {
  const [generatingLink, setGeneratingLink] = createSignal(false);
  const [testLink, setTestLink] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [generateError, setGenerateError] = createSignal<string | null>(null);

  const handleGenerateTestLink = async () => {
    setGeneratingLink(true);
    setGenerateError(null);
    setTestLink(null);

    try {
      const res = await fetch("/api/meet/create");
      const data = await res.json();

      if (!res.ok || !data.meetUri) {
        setGenerateError(
          data.error || "Failed to create Google Meet link. Please re-authenticate."
        );
        return;
      }

      setTestLink(data.meetUri);
    } catch {
      setGenerateError("Network error while creating meeting link.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    const link = testLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <div class="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/80">
      <div>
        {/* Header */}
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-xs">
              <Video size={22} />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-base font-semibold text-foreground">
                  Google Meet
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
                  ? "Automatic video room generation for meetings & bookings."
                  : "Connect to generate video conferencing spaces."}
              </p>
            </div>
          </div>
        </div>

        {/* Card Content */}
        <Show
          when={props.connected}
          fallback={
            <div class="my-3 space-y-3">
              <p class="text-xs leading-relaxed text-muted-foreground">
                Connect your Google account to automatically create instant Google Meet
                links when marketplace clients book calls or team meetings are scheduled.
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
                    <span>Connect Google Meet</span>
                    <ExternalLink size={14} class="text-muted-foreground" />
                  </>
                )}
              </button>
            </div>
          }
        >
          <div class="space-y-3.5">
            {/* Features Enabled */}
            <div class="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-2 text-foreground font-medium">
                  <Calendar size={14} class="text-teal-600 dark:text-teal-400" />
                  Marketplace Bookings
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Auto-link active
                </span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-2 text-foreground font-medium">
                  <Users size={14} class="text-teal-600 dark:text-teal-400" />
                  Team Meetings
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Auto-link active
                </span>
              </div>
            </div>

            {/* Test Link Generator */}
            <div class="pt-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-muted-foreground">
                  Quick Action
                </span>
                <button
                  type="button"
                  onClick={handleGenerateTestLink}
                  disabled={generatingLink()}
                  class="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {generatingLink() ? (
                    <Loader2 size={13} class="animate-spin" />
                  ) : (
                    <Sparkles size={13} class="text-amber-500" />
                  )}
                  {generatingLink() ? "Generating..." : "Generate Test Meeting"}
                </button>
              </div>

              {/* Generated link display */}
              <Show when={testLink()}>
                <div class="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
                  <span class="flex-1 truncate font-mono text-foreground font-medium select-all">
                    {testLink()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    class="inline-flex shrink-0 items-center gap-1 rounded bg-background px-2 py-1 text-[11px] font-medium border border-border hover:bg-muted text-foreground transition-colors"
                  >
                    {copied() ? (
                      <>
                        <Check size={12} class="text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <a
                    href={testLink() ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex shrink-0 items-center gap-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-teal-700 transition-colors"
                  >
                    <span>Join</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </Show>

              {/* Error generating test link */}
              <Show when={generateError()}>
                <div class="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                  {generateError()}
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
