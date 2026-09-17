import { Field } from "@ark-ui/solid/field";
import { RatingGroup } from "@ark-ui/solid/rating-group";
import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import MessageSquare from "lucide-solid/icons/message-square";
import Pencil from "lucide-solid/icons/pencil";
import Printer from "lucide-solid/icons/printer";
import QrCode from "lucide-solid/icons/qr-code";
import Send from "lucide-solid/icons/send";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import X from "lucide-solid/icons/x";
import QRCode from "qrcode";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { Rating, ReviewSuggestion } from "@/features/reviews/review-types";
import { QRCodeDisplay } from "~/components/review/qr-code-display";
import { CopyButton } from "~/components/ui/copy-button";
import { notify } from "~/components/ui/toast";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import { useSettings } from "~/stores/settings-store";

const tones = ["Simple", "Professional", "Casual"] as const;
const PLATFORMS_KEY = "flonion:review-platforms:v1";
const RATE_LIMIT_COOLDOWN = 30;
const SUCCESS_COOLDOWN = 5;

function loadPlatforms(): string[] {
  try {
    const raw = localStorage.getItem(PLATFORMS_KEY);
    if (!raw) return ["google"];
    const parsed = JSON.parse(raw) as string[];
    const known = new Set(REVIEW_PLATFORMS.map((p) => p.slug));
    const filtered = parsed.filter((s) => known.has(s));
    return filtered.length > 0 ? filtered : ["google"];
  } catch {
    return ["google"];
  }
}

function splitKeywords(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ReviewComposerPage() {
  const settings = useSettings();

  // DS §6: pre-selected rating — the owner suggests a rating, the customer
  // can always change it before submitting.
  const [rating, setRating] = createSignal<Rating>(5);
  const [text, setText] = createSignal("");
  const [keywordInput, setKeywordInput] = createSignal("");
  const [keywords, setKeywords] = createSignal<string[]>([]);
  const [platforms, setPlatforms] = createSignal<string[]>(["google"]);

  const [suggestions, setSuggestions] = createSignal<ReviewSuggestion[]>([]);
  const [pickedId, setPickedId] = createSignal<string | null>(null);
  const [aiLoading, setAiLoading] = createSignal(false);
  const [aiError, setAiError] = createSignal("");
  const [cooldownSecs, setCooldownSecs] = createSignal(0);

  const [shareUrl, setShareUrl] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [createError, setCreateError] = createSignal("");
  const [scanCount, setScanCount] = createSignal<number | null>(null);
  const [statusMessage, setStatusMessage] = createSignal("");
  const [downloadingSvg, setDownloadingSvg] = createSignal(false);

  let previewHeadingRef: HTMLHeadingElement | undefined;
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    setPlatforms(loadPlatforms());
    setKeywords(splitKeywords(settings.keywords()));
    refreshScanCount();
  });

  createEffect(() => {
    try {
      localStorage.setItem(PLATFORMS_KEY, JSON.stringify(platforms()));
    } catch {
      // Private mode — toggles simply won't persist.
    }
  });

  onCleanup(() => clearInterval(cooldownTimer));

  const startCooldown = (secs: number) => {
    clearInterval(cooldownTimer);
    setCooldownSecs(secs);
    cooldownTimer = setInterval(() => {
      setCooldownSecs((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const refreshScanCount = async () => {
    try {
      const res = await fetch("/api/reviews/analytics");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.totalQrScans === "number")
        setScanCount(data.totalQrScans);
    } catch {
      // Supplementary hint; the page works without it.
    }
  };

  const qrUrl = createMemo(() => {
    const identifier = settings.username() || settings.businessId();
    if (identifier && typeof window !== "undefined")
      return `${window.location.origin}/qr/${identifier}`;
    return shareUrl();
  });

  const togglePlatform = (slug: string) => {
    setPlatforms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const addKeyword = () => {
    const value = keywordInput()
      .trim()
      .replace(/[,;]+$/, "");
    if (!value || keywords().length >= 10) return;
    if (keywords().some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywordInput("");
      return;
    }
    setKeywords((prev) => [...prev, value]);
    setKeywordInput("");
  };

  const removeKeyword = (value: string) => {
    setKeywords((prev) => prev.filter((k) => k !== value));
  };

  const fetchSuggestions = async () => {
    if (aiLoading() || cooldownSecs() > 0) return;
    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftText: text().trim(),
          starRating: rating(),
          keywords: keywords().join(", "),
          businessName: settings.businessName(),
        }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const secs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : RATE_LIMIT_COOLDOWN;
        startCooldown(secs);
        setAiError(
          `AI limit reached — your draft is preserved. Try again in ${secs}s.`,
        );
        notify("warning", "AI limit reached", "Your draft is preserved.");
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const texts: string[] = data.suggestedReviews;
      if (!Array.isArray(texts) || texts.length === 0)
        throw new Error("No suggestions returned from AI service.");

      setSuggestions(
        texts.slice(0, 3).map((t, i) => ({
          id: `ai-${Date.now()}-${i}`,
          tone: tones[i] ?? "Professional",
          text: t,
          recommended: i === 0,
        })),
      );
      setPickedId(null);
      setStatusMessage("3 AI drafts ready — edit before posting.");
      startCooldown(SUCCESS_COOLDOWN);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setAiError(`AI service unavailable: ${message} Your draft is preserved.`);
      notify("error", "AI service unavailable", "Your draft is preserved.");
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (suggestion: ReviewSuggestion) => {
    setText(suggestion.text);
    setPickedId(suggestion.id);
    setStatusMessage(`${suggestion.tone} AI draft applied — edit as needed.`);
  };

  const createShareLink = async () => {
    if (creating()) return;
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/reviews/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text().trim(),
          rating: rating(),
          keywords: keywords().join(", "),
          platforms: platforms(),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to create share link");
      }
      const { url } = await response.json();
      const fullUrl = `${window.location.origin}${url}`;
      setShareUrl(fullUrl);
      setStatusMessage("Share link and QR ready.");
      notify("success", "Link ready", "Share link copied to clipboard.");
      try {
        await navigator.clipboard.writeText(qrUrl() ?? fullUrl);
      } catch {
        // Clipboard unavailable — the Copy button remains.
      }
      refreshScanCount();
      previewHeadingRef?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setCreateError(`Could not generate share link: ${message}`);
      setStatusMessage("Could not generate share link.");
    } finally {
      setCreating(false);
    }
  };

  const whatsappHref = createMemo(() => {
    const url = qrUrl();
    if (!url) return undefined;
    const message = `Hi! We'd love your feedback on ${settings.businessName() || "our business"}. Tap to leave a review:`;
    return `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
  });

  const downloadSvg = async () => {
    const url = qrUrl();
    if (!url || downloadingSvg()) return;
    setDownloadingSvg(true);
    try {
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `qr-code-${settings.businessName() || "review"}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      notify("success", "QR downloaded", "SVG saved for print.");
    } catch {
      notify("error", "Download failed", "Could not generate the SVG file.");
    } finally {
      setDownloadingSvg(false);
    }
  };

  const printTableStand = async () => {
    const url = qrUrl();
    if (!url) return;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 700,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
      const win = window.open("", "_blank", "width=600,height=800");
      if (!win) {
        notify("error", "Pop-up blocked", "Allow pop-ups to print the stand.");
        return;
      }
      // The window inherits this app's origin, so interpolated values must be
      // escaped or a business name could run script here.
      const name = escapeHtml(settings.businessName() ?? "");
      const safeUrl = escapeHtml(url);
      win.document.write(`<!doctype html><html><head><title>Table stand — ${name}</title>
        <style>@page{size:A6 portrait;margin:10mm}body{font-family:system-ui,sans-serif;text-align:center;color:#1a1a2e;margin:0;padding:8mm}img{width:70mm;height:70mm}h1{font-size:16pt;margin:6mm 0 2mm}p{font-size:10pt;color:#57534e;margin:0 0 4mm}.url{font-family:monospace;font-size:7pt;word-break:break-all}</style>
        </head><body><h1>${name || "Leave us a review"}</h1>
        <p>Scan to leave a review</p><img src="${dataUrl}" alt="QR code linking to ${safeUrl}" />
        <p class="url">${safeUrl}</p><script>onload=()=>{print()}</script></body></html>`);
      win.document.close();
    } catch {
      notify("error", "Print failed", "Could not prepare the table stand.");
    }
  };

  const formCard = (
    <section
      aria-labelledby="composer-heading"
      class="rounded-card border border-border bg-card p-5 shadow-md sm:p-6"
    >
      <div class="flex items-center gap-3">
        <Show when={settings.logo()}>
          <img
            src={settings.logo()!}
            alt=""
            class="size-10 shrink-0 rounded-control object-contain"
          />
        </Show>
        <div class="min-w-0">
          <h2
            id="composer-heading"
            class="font-heading text-xl font-semibold text-foreground"
          >
            Review request
          </h2>
          <p class="truncate text-sm text-muted-foreground">
            {settings.businessName() || "Your business"}
          </p>
        </div>
      </div>

      {/* Rating — pre-selected per spec, customer can change it later. */}
      <fieldset class="mt-6">
        <legend class="sr-only">Suggested rating</legend>
        <RatingGroup.Root
          value={rating()}
          onValueChange={(details) => setRating(details.value as Rating)}
          count={5}
        >
          <div class="flex items-center justify-between gap-3">
            <RatingGroup.Label class="text-sm font-medium text-foreground">
              Suggested rating
            </RatingGroup.Label>
            <span
              class="tnum text-sm font-medium text-star-text"
              aria-live="polite"
            >
              {rating()}.0
            </span>
          </div>
          <RatingGroup.Control class="mt-2 flex items-center gap-1">
            <RatingGroup.Context>
              {(api) => (
                <For each={api().items}>
                  {(item) => (
                    <RatingGroup.Item
                      index={item}
                      aria-label={`${item} star${item === 1 ? "" : "s"}`}
                      class="inline-flex size-11 items-center justify-center rounded-control transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <RatingGroup.ItemContext>
                        {(itemState) => (
                          <Star
                            class="size-7 text-star"
                            fill={
                              itemState().highlighted ? "currentColor" : "none"
                            }
                            aria-hidden="true"
                          />
                        )}
                      </RatingGroup.ItemContext>
                    </RatingGroup.Item>
                  )}
                </For>
              )}
            </RatingGroup.Context>
            <RatingGroup.HiddenInput />
          </RatingGroup.Control>
        </RatingGroup.Root>
        <p class="mt-1.5 text-xs text-muted-foreground italic">
          Your customer can change this before submitting.
        </p>
      </fieldset>

      {/* Optional starter text */}
      <Field.Root class="mt-5">
        <Field.Label class="text-sm font-medium text-foreground">
          Starter message{" "}
          <span class="font-normal text-muted-foreground">(optional)</span>
        </Field.Label>
        <Field.Textarea
          id="starter-text"
          value={text()}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          placeholder={`Hi! We'd love to hear about your experience with ${settings.businessName() || "us"}...`}
          rows={4}
          class="mt-2 w-full resize-y rounded-control border border-input bg-background px-3 py-3 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Field.HelperText class="mt-1.5 text-xs text-muted-foreground">
          Personalise it, or leave it blank and let AI draft from your keywords.
        </Field.HelperText>
      </Field.Root>

      {/* Keywords as chips */}
      <div class="mt-5">
        <label for="keywords-input" class="text-sm font-medium text-foreground">
          Keywords{" "}
          <span class="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div class="mt-2 flex gap-2">
          <input
            id="keywords-input"
            type="text"
            value={keywordInput()}
            onInput={(e) =>
              setKeywordInput((e.target as HTMLInputElement).value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="e.g. thali, family restaurant"
            disabled={keywords().length >= 10}
            class="h-11 min-w-0 flex-1 rounded-control border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addKeyword}
            disabled={!keywordInput().trim() || keywords().length >= 10}
            class="inline-flex h-11 shrink-0 items-center rounded-control border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <Show when={keywords().length > 0}>
          <ul class="mt-2 flex flex-wrap gap-2" aria-label="Keywords">
            <For each={keywords()}>
              {(keyword) => (
                <li class="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1 pl-3 pr-1.5 text-sm font-medium text-primary">
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    aria-label={`Remove keyword ${keyword}`}
                    class="inline-flex size-7 items-center justify-center rounded-full transition-colors hover:bg-primary/15"
                  >
                    <X class="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      {/* Platforms */}
      <fieldset class="mt-5">
        <legend class="text-sm font-medium text-foreground">
          Review platforms
        </legend>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Customers are redirected here after submitting.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <For each={REVIEW_PLATFORMS.filter((p) => p.slug !== "other")}>
            {(platform) => (
              <button
                type="button"
                aria-pressed={platforms().includes(platform.slug)}
                onClick={() => togglePlatform(platform.slug)}
                class="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                classList={{
                  "border-primary bg-primary/10 text-primary":
                    platforms().includes(platform.slug),
                  "border-border bg-background text-muted-foreground hover:bg-muted":
                    !platforms().includes(platform.slug),
                }}
              >
                <span
                  class="size-2 rounded-full"
                  style={{ background: platform.color }}
                  aria-hidden="true"
                />
                {platform.label}
              </button>
            )}
          </For>
        </div>
      </fieldset>

      {/* Actions */}
      <div class="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={aiLoading() || cooldownSecs() > 0}
          class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Show
            when={!aiLoading()}
            fallback={
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            }
          >
            <Sparkles class="size-4" aria-hidden="true" />
          </Show>
          {aiLoading()
            ? "Writing drafts…"
            : cooldownSecs() > 0
              ? `Try again in ${cooldownSecs()}s`
              : text().trim()
                ? "Improve with AI"
                : "Draft with AI"}
        </button>
        <button
          type="button"
          onClick={createShareLink}
          disabled={creating()}
          class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Show
            when={!creating()}
            fallback={
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            }
          >
            <QrCode class="size-4" aria-hidden="true" />
          </Show>
          {creating()
            ? "Creating…"
            : shareUrl()
              ? "Recreate link & QR"
              : "Create link & QR"}
        </button>
      </div>
      <Show when={createError()}>
        <p role="alert" class="mt-3 text-sm text-destructive">
          {createError()}
        </p>
      </Show>

      {/* AI Draft Reveal — DS §4 */}
      <section
        aria-labelledby="ai-drafts-heading"
        aria-busy={aiLoading()}
        class="mt-6"
      >
        <h3
          id="ai-drafts-heading"
          class="flex flex-wrap items-center gap-2 text-base font-medium text-foreground"
        >
          <Sparkles size={18} aria-hidden="true" class="text-primary" />
          AI drafts
          <span class="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning">
            AI draft · edit before posting
          </span>
        </h3>

        <Show
          when={!aiLoading()}
          fallback={
            <div class="mt-3 grid gap-3" role="status">
              <span class="sr-only">Writing drafts…</span>
              <For each={[0, 1, 2]}>
                {() => (
                  <div class="skeleton h-24 rounded-card border border-border bg-muted" />
                )}
              </For>
            </div>
          }
        >
          <Show
            when={suggestions().length > 0}
            fallback={
              <Show when={!aiError()}>
                <p class="mt-3 rounded-card border border-dashed border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                  Add a starter message or keywords, then choose{" "}
                  <span class="font-medium text-foreground">
                    {text().trim() ? "Improve with AI" : "Draft with AI"}
                  </span>{" "}
                  to generate three editable drafts.
                </p>
              </Show>
            }
          >
            <ul class="mt-3 grid gap-3" aria-live="polite">
              <For each={suggestions()}>
                {(suggestion, i) => (
                  <li
                    class="e4-card-enter"
                    style={{ "animation-delay": `${i() * 60}ms` }}
                  >
                    <div
                      class="rounded-card border bg-card p-4 transition-colors"
                      classList={{
                        "border-primary": pickedId() === suggestion.id,
                        "border-border hover:border-primary/60":
                          pickedId() !== suggestion.id,
                      }}
                      style={
                        pickedId() !== null && pickedId() !== suggestion.id
                          ? { opacity: "0.6" }
                          : {}
                      }
                    >
                      <div class="flex items-center gap-2">
                        <MessageSquare
                          class="size-3.5 text-secondary"
                          aria-hidden="true"
                        />
                        <span class="text-xs font-medium uppercase tracking-wider text-secondary">
                          {suggestion.tone}
                        </span>
                        <Show when={suggestion.recommended}>
                          <span class="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
                            <Star
                              class="size-3"
                              aria-hidden="true"
                              fill="currentColor"
                            />
                            Recommended
                          </span>
                        </Show>
                      </div>
                      <p class="mt-2 text-sm leading-6 text-foreground">
                        {suggestion.text}
                      </p>
                      <button
                        type="button"
                        aria-pressed={pickedId() === suggestion.id}
                        onClick={() => applySuggestion(suggestion)}
                        class="mt-3 inline-flex h-11 items-center gap-1.5 rounded-control bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        <Pencil class="size-3.5" aria-hidden="true" />
                        {pickedId() === suggestion.id
                          ? "Applied — edit above"
                          : "Use this version"}
                      </button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
        <Show when={aiError()}>
          <p role="alert" class="mt-3 text-sm text-destructive">
            {aiError()}
          </p>
        </Show>
      </section>
    </section>
  );

  const previewCard = (
    <section aria-labelledby="preview-heading" class="lg:sticky lg:top-6">
      <h2
        id="preview-heading"
        ref={previewHeadingRef}
        tabIndex={-1}
        class="font-heading text-lg font-semibold text-foreground focus:outline-none"
      >
        Live preview
      </h2>
      <div class="mt-3">
        <Show
          when={shareUrl()}
          fallback={
            <div class="grid gap-3 rounded-card border border-dashed border-border bg-card p-6 text-center">
              <QrCode
                class="mx-auto size-10 text-muted-foreground/40"
                aria-hidden="true"
              />
              <div>
                <p class="font-heading text-lg font-medium text-foreground">
                  No link yet
                </p>
                <ol class="mx-auto mt-2 max-w-55 space-y-1 text-left text-sm text-muted-foreground">
                  <li>1. Pick a rating and platforms</li>
                  <li>2. Press “Create link &amp; QR”</li>
                  <li>3. Print the QR for your counter</li>
                </ol>
              </div>
              <button
                type="button"
                onClick={createShareLink}
                disabled={creating()}
                class="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <Show
                  when={!creating()}
                  fallback={
                    <LoaderCircle
                      class="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  }
                >
                  <QrCode class="size-4" aria-hidden="true" />
                </Show>
                {creating() ? "Creating…" : "Generate share link"}
              </button>
            </div>
          }
        >
          <div class="e2-enter grid gap-3">
            <QRCodeDisplay
              url={shareUrl()}
              logo={settings.logo()}
              businessName={settings.businessName()}
              businessUsername={settings.username()}
              businessId={settings.businessId()}
            />
            <div class="rounded-card border border-border bg-card p-4 shadow-sm">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Canonical URL
              </p>
              <p class="tnum mt-1 truncate font-mono text-xs text-foreground">
                {qrUrl()}
              </p>
              <div class="mt-3 grid gap-2">
                <CopyButton value={() => qrUrl() ?? ""} class="w-full" />
                <Show when={whatsappHref()}>
                  <a
                    href={whatsappHref()}
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-success-muted px-4 text-sm font-medium text-success transition-opacity hover:opacity-90"
                  >
                    <Send class="size-4" aria-hidden="true" />
                    Share to WhatsApp
                  </a>
                </Show>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={downloadingSvg()}
                    class="inline-flex h-11 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Show
                      when={!downloadingSvg()}
                      fallback={
                        <LoaderCircle
                          class="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      }
                    >
                      <Pencil class="size-4" aria-hidden="true" />
                    </Show>
                    SVG
                  </button>
                  <button
                    type="button"
                    onClick={printTableStand}
                    class="inline-flex h-11 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Printer class="size-4" aria-hidden="true" />
                    A6 stand
                  </button>
                </div>
              </div>
              <Show when={scanCount() !== null}>
                <p class="tnum mt-3 text-xs text-muted-foreground">
                  {scanCount()} QR {scanCount() === 1 ? "scan" : "scans"} so far
                </p>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );

  return (
    <div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <Title>Ask for a Review — Flonion</Title>
      <nav aria-label="Breadcrumb" class="mb-2 text-sm text-muted-foreground">
        <ol class="flex items-center gap-1.5">
          <li>
            <a
              href="/reviews/inbox"
              class="transition-colors hover:text-foreground"
            >
              Reviews
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" class="font-medium text-foreground">
            Ask for a Review
          </li>
        </ol>
      </nav>

      <div class="mb-6 max-w-2xl">
        <h1 class="font-heading text-3xl font-semibold text-foreground">
          Ask for a Review
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Create a shareable link and QR code in under a minute — print it,
          stick it on the counter, done.
        </p>
      </div>

      {/* Mobile: Form / Preview tabs. Desktop: side-by-side 7/5. */}
      <div class="lg:hidden">
        <Tabs.Root defaultValue="form" class="w-full">
          <Tabs.List
            aria-label="Composer sections"
            class="grid grid-cols-2 gap-1 rounded-card border border-border bg-muted/50 p-1"
          >
            <Tabs.Trigger
              value="form"
              class="inline-flex h-11 items-center justify-center gap-2 rounded-control text-sm font-medium text-muted-foreground transition-colors data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Pencil class="size-4" aria-hidden="true" />
              Compose
            </Tabs.Trigger>
            <Tabs.Trigger
              value="preview"
              class="inline-flex h-11 items-center justify-center gap-2 rounded-control text-sm font-medium text-muted-foreground transition-colors data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <QrCode class="size-4" aria-hidden="true" />
              Preview
              <Show when={shareUrl()}>
                <span
                  class="inline-flex size-2 rounded-full bg-success"
                  aria-label="Link ready"
                  role="img"
                />
              </Show>
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="form" class="e1-enter mt-4">
            {formCard}
          </Tabs.Content>
          <Tabs.Content value="preview" class="e1-enter mt-4">
            {previewCard}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <div class="hidden gap-6 lg:grid lg:grid-cols-12">
        <div class="min-w-0 lg:col-span-7">{formCard}</div>
        <div class="min-w-0 lg:col-span-5">{previewCard}</div>
      </div>

      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {statusMessage()}
      </div>
    </div>
  );
}
