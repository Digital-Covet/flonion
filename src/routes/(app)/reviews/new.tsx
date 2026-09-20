import { Title } from "@solidjs/meta";
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconShare,
  IconSparkles,
} from "@tabler/icons-solidjs";
import {
  batch,
  createEffect,
  createSignal,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useApp } from "~/components/app/context";
import { FieldError, inputBase, labelClass } from "~/components/auth/AuthShell";
import { Skeleton } from "~/components/dashboard/ui";
import { QrTicket } from "~/components/landing/brand";
import { btnSecondary, Notice, Spinner } from "~/components/onboarding/ui";
import {
  ActionButton,
  CooldownRing,
  CopyButton,
  downloadQrPng,
  KEYWORDS_CHARS_MAX,
  KeywordField,
  NAME_MAX,
  PhonePreview,
  PROMPT_DEFAULT,
  PROMPT_MAX,
  printQrSheet,
  qrLink,
  readPrompt,
  requestSuggestions,
  reviewLink,
  SuggestionCards,
  SuggestionSkeletons,
  saveRequest,
  splitKeywords,
  TEXT_MAX,
  writePrompt,
} from "~/components/reviews/composer";
import { formatWait, Segmented } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

type Field = "name" | "text" | "keywords";

type AiState = {
  status: "idle" | "loading" | "error";
  suggestions: string[];
  error?: string;
  retryAt?: number;
  cooldownMs?: number;
};

const EMPTY_AI: AiState = { status: "idle", suggestions: [] };

/** Edits save to the request this long after the last keystroke. */
const SAVE_DELAY_MS = 700;

type RequestState =
  | { kind: "creating" }
  | { kind: "ready"; id: string }
  | { kind: "failed"; message: string };

type SaveState = "idle" | "pending" | "saving" | "saved" | "invalid" | "error";

export default function ReviewComposerPage() {
  const { business } = useApp();
  const info = () => business.latest;

  // ── Form
  const [customerName, setCustomerName] = createSignal("");
  const [text, setText] = createSignal("");
  const [keywords, setKeywords] = createSignal<string[]>([]);
  const [keywordsTouched, setKeywordsTouched] = createSignal(false);
  const [errors, setErrors] = createSignal<Partial<Record<Field, string>>>({});

  // Keywords are pre-filled from settings once, unless the owner already edited them.
  createEffect(
    on(info, (b) => {
      if (b && !keywordsTouched()) {
        setKeywords(splitKeywords(b.keywords ?? ""));
        // The request was created before settings arrived; store them on it.
        if (splitKeywords(b.keywords ?? "").length) scheduleSave();
      }
    }),
  );

  function changeKeywords(next: string[]) {
    setKeywordsTouched(true);
    setKeywords(next);
    setErrors((e) => ({ ...e, keywords: undefined }));
    scheduleSave();
  }

  // ── Mobile: form and QR/preview share one column behind a toggle
  const [view, setView] = createSignal<"form" | "preview">("form");

  // ── The request: created as soon as the page loads, so the QR is ready at once
  const [request, setRequest] = createSignal<RequestState>({
    kind: "creating",
  });
  const [saveState, setSaveState] = createSignal<SaveState>("idle");
  const requestId = () => {
    const r = request();
    return r.kind === "ready" ? r.id : undefined;
  };

  function validate() {
    const next: Partial<Record<Field, string>> = {};
    if (customerName().trim().length > NAME_MAX)
      next.name = "Keep the name under 100 characters.";
    if (text().length > TEXT_MAX)
      next.text = "Keep the suggestion under 5,000 characters.";
    if (keywords().join(", ").length > KEYWORDS_CHARS_MAX)
      next.keywords = "Use fewer or shorter keywords.";
    return next;
  }

  const hasErrors = (e: Partial<Record<Field, string>>) =>
    Boolean(e.name || e.text || e.keywords);

  const values = () => ({
    customerName: customerName(),
    text: text(),
    keywords: keywords(),
  });

  async function createNew() {
    setRequest({ kind: "creating" });
    setSaveState("idle");
    const result = await saveRequest(values());
    if (result.kind === "ok") {
      setRequest({ kind: "ready", id: result.reviewId });
      setSaveState("saved");
      announce("Your review link and QR code are ready.");
      // Anything typed while the request was being created is saved now.
      if (dirty) void flush();
    } else if (result.kind === "unauthorized") {
      window.location.assign("/login?callbackURL=/reviews/new");
    } else {
      setRequest({
        kind: "failed",
        message:
          result.kind === "invalid"
            ? result.message
            : "We couldn't create your review link.",
      });
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let saving: Promise<void> | undefined;
  onCleanup(() => clearTimeout(saveTimer));

  function scheduleSave() {
    dirty = true;
    setSaveState("pending");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  async function flush(): Promise<void> {
    clearTimeout(saveTimer);
    const id = requestId();
    if (!id || !dirty) return;
    if (saving) {
      await saving;
      return flush();
    }

    const invalid = validate();
    setErrors(invalid);
    if (hasErrors(invalid)) {
      setSaveState("invalid");
      return;
    }

    dirty = false;
    setSaveState("saving");
    saving = (async () => {
      const result = await saveRequest({ id, ...values() });
      if (result.kind === "ok") {
        setSaveState(dirty ? "pending" : "saved");
      } else if (result.kind === "unauthorized") {
        window.location.assign("/login?callbackURL=/reviews/new");
      } else if (result.kind === "invalid" && result.field) {
        dirty = true;
        setErrors({ [result.field]: result.message });
        setSaveState("invalid");
      } else {
        dirty = true;
        setSaveState("error");
      }
    })();
    await saving;
    saving = undefined;
  }

  onMount(() => void createNew());

  async function createAnother() {
    await flush();
    batch(() => {
      setCustomerName("");
      setText("");
      setErrors({});
      setAi((s) => ({
        ...EMPTY_AI,
        retryAt: s.retryAt,
        cooldownMs: s.cooldownMs,
      }));
    });
    dirty = false;
    await createNew();
    document.getElementById("rn-name")?.focus();
  }

  // ── AI suggestions
  const [ai, setAi] = createSignal<AiState>(EMPTY_AI);
  const [now, setNow] = createSignal(Date.now());
  const waitMs = () => Math.max(0, (ai().retryAt ?? 0) - now());
  const coolingDown = () => waitMs() > 0;

  createEffect(() => {
    const until = ai().retryAt;
    if (!until || until <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  async function suggest() {
    if (ai().status === "loading" || coolingDown()) return;
    setAi((s) => ({ ...s, status: "loading", error: undefined }));
    announce("Writing suggestions…");
    const result = await requestSuggestions({
      text: text(),
      keywords: keywords(),
      businessName: info()?.businessName,
    });
    if (result.kind === "ok") {
      setAi({ status: "idle", suggestions: result.suggestions });
      announce(
        `${result.suggestions.length} AI suggestions ready. Pick one to use or edit.`,
      );
    } else if (result.kind === "rate-limited") {
      setAi((s) => ({
        ...s,
        status: "idle",
        retryAt: result.retryAt,
        cooldownMs: result.retryAt - Date.now(),
      }));
      announce("Suggestion limit reached. Try again later.");
    } else {
      setAi((s) => ({ ...s, status: "error", error: result.message }));
    }
  }

  let textarea: HTMLTextAreaElement | undefined;

  function applySuggestion(value: string, edit: boolean) {
    setText(value);
    setErrors((e) => ({ ...e, text: undefined }));
    scheduleSave();
    announce(
      edit
        ? "Suggestion added to the text box for editing."
        : "Suggestion added.",
    );
    if (edit && textarea) {
      textarea.focus();
      textarea.setSelectionRange(value.length, value.length);
    }
  }

  // Auto-grow the suggestion box.
  createEffect(() => {
    text();
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  });

  // ── Live region
  const [message, setMessage] = createSignal("");
  function announce(value: string) {
    setMessage("");
    queueMicrotask(() => setMessage(value));
  }

  // ── QR ticket prompt: kept across "Create another" and remembered per browser
  const [prompt, setPrompt] = createSignal(PROMPT_DEFAULT);
  onMount(() => setPrompt(readPrompt()));
  function changePrompt(value: string) {
    setPrompt(value);
    writePrompt(value);
  }

  return (
    <>
      <Title>New review request · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-5">
        <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-text md:text-2xl">
              New review request
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-text-muted">
              Your link and QR code are ready to share. Add details below and
              they save automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createAnother()}
            disabled={request().kind === "creating"}
            class={cn(
              btnSecondary,
              "shrink-0 self-start sm:self-auto disabled:cursor-progress disabled:opacity-70",
            )}
          >
            <IconPlus aria-hidden="true" class="size-5" />
            Create another
          </button>
        </header>

        <Segmented
          legend="Show"
          name="composer-view"
          options={[
            { value: "form", label: "Details" },
            { value: "preview", label: "QR & preview" },
          ]}
          value={view()}
          onChange={setView}
          class="lg:hidden"
        />

        <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <form
            novalidate
            onSubmit={(e) => {
              e.preventDefault();
              void flush();
            }}
            aria-label="Review request details"
            class={cn(
              "rounded-lg border border-border bg-surface p-4 md:p-6 lg:col-span-7",
              view() === "preview" && "max-lg:hidden",
            )}
          >
            <div class="flex flex-col gap-5">
              {/* Customer name */}
              <div class="flex flex-col gap-1.5">
                <label for="rn-name" class={labelClass}>
                  Customer name{" "}
                  <span class="font-normal text-text-muted">(optional)</span>
                </label>
                <input
                  id="rn-name"
                  type="text"
                  autocomplete="off"
                  maxLength={NAME_MAX}
                  placeholder="Priya Sharma"
                  value={customerName()}
                  onInput={(e) => {
                    setCustomerName(e.currentTarget.value);
                    setErrors((x) => ({ ...x, name: undefined }));
                    scheduleSave();
                  }}
                  aria-invalid={errors().name ? "true" : undefined}
                  aria-describedby={cn(
                    "rn-name-hint",
                    errors().name && "rn-name-error",
                  )}
                  class={inputBase}
                />
                <p id="rn-name-hint" class="text-sm text-text-muted">
                  Used to greet them on the review page. Leave it empty for a
                  counter QR everyone can scan.
                </p>
                <FieldError id="rn-name-error" message={errors().name} />
              </div>

              <KeywordField
                id="rn-keywords"
                keywords={keywords()}
                onChange={changeKeywords}
                error={errors().keywords}
              />

              {/* Suggested text */}
              <div class="flex flex-col gap-1.5">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <label for="rn-text" class={labelClass}>
                    Suggested text{" "}
                    <span class="font-normal text-text-muted">(optional)</span>
                  </label>
                  <span
                    class={cn(
                      "font-mono text-xs tabular-nums",
                      text().length > TEXT_MAX
                        ? "text-error"
                        : "text-text-muted",
                    )}
                  >
                    {text().length.toLocaleString()} /{" "}
                    {TEXT_MAX.toLocaleString()}
                  </span>
                </div>
                <textarea
                  ref={textarea}
                  id="rn-text"
                  rows={4}
                  value={text()}
                  onInput={(e) => {
                    setText(e.currentTarget.value);
                    setErrors((x) => ({ ...x, text: undefined }));
                    scheduleSave();
                  }}
                  placeholder="A few words about what makes a visit here good. Customers can change all of it."
                  aria-invalid={errors().text ? "true" : undefined}
                  aria-describedby={cn(
                    "rn-text-hint",
                    errors().text && "rn-text-error",
                  )}
                  class={cn(
                    inputBase,
                    "max-h-[50dvh] min-h-[112px] resize-none py-2.5",
                  )}
                />
                <p id="rn-text-hint" class="text-sm text-text-muted">
                  Suggestion shown to customer as a starting point. They can
                  edit or delete it before posting.
                </p>
                <FieldError id="rn-text-error" message={errors().text} />
              </div>

              {/* AI suggestions */}
              <section
                aria-labelledby="rn-ai-heading"
                class="flex flex-col gap-3 rounded-lg bg-primary-soft/50 p-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0">
                    <h2
                      id="rn-ai-heading"
                      class="font-display text-base font-semibold text-text"
                    >
                      Need a starting point?
                    </h2>
                    <p class="text-sm text-text-muted">
                      AI writes three versions from your text and keywords.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={suggest}
                    disabled={ai().status === "loading" || coolingDown()}
                    class={cn(
                      btnSecondary,
                      "w-full bg-surface sm:w-auto disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-surface",
                    )}
                  >
                    <Switch
                      fallback={
                        <IconSparkles
                          aria-hidden="true"
                          class="size-5 text-primary"
                        />
                      }
                    >
                      <Match when={ai().status === "loading"}>
                        <Spinner />
                      </Match>
                      <Match when={coolingDown()}>
                        <CooldownRing
                          waitMs={waitMs()}
                          totalMs={ai().cooldownMs ?? 0}
                        />
                      </Match>
                    </Switch>
                    <Switch
                      fallback={
                        ai().suggestions.length
                          ? "Suggest again"
                          : "Suggest with AI"
                      }
                    >
                      <Match when={ai().status === "loading"}>Writing…</Match>
                      <Match when={coolingDown()}>
                        <span>
                          Try again in{" "}
                          <span class="font-mono tabular-nums">
                            {formatWait(waitMs())}
                          </span>
                        </span>
                      </Match>
                    </Switch>
                  </button>
                </div>

                <Show when={ai().status === "error" && ai().error}>
                  {(msg) => (
                    <Notice tone="error">
                      {msg()} Your text is unchanged.
                    </Notice>
                  )}
                </Show>

                <Switch>
                  <Match when={ai().status === "loading"}>
                    <SuggestionSkeletons />
                  </Match>
                  <Match when={ai().suggestions.length > 0}>
                    <Show when={ai().suggestions} keyed>
                      {(list) => (
                        <SuggestionCards
                          suggestions={list}
                          onUse={(v) => applySuggestion(v, false)}
                          onEdit={(v) => applySuggestion(v, true)}
                        />
                      )}
                    </Show>
                  </Match>
                </Switch>
              </section>

              <Notice tone="info">
                Customers always choose their own star rating, and every rating
                sees the same places to post.
              </Notice>
            </div>

            <div class="mt-6 flex min-h-11 items-center border-t border-border pt-4">
              <SaveStatus state={saveState()} onRetry={() => void flush()} />
            </div>
          </form>

          <aside
            aria-labelledby="rn-preview-heading"
            class={cn(
              "flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5",
              view() === "form" && "max-lg:hidden",
            )}
          >
            <div class="flex items-baseline justify-between gap-2">
              <h2
                id="rn-preview-heading"
                class="font-display text-base font-semibold text-text"
              >
                What your customer sees
              </h2>
              <span class="text-xs text-text-muted">Live preview</span>
            </div>

            <Switch>
              <Match when={request().kind === "creating"}>
                <ShareSkeleton />
              </Match>
              <Match
                when={(() => {
                  const r = request();
                  return r.kind === "failed" ? r : undefined;
                })()}
              >
                {(failed) => (
                  <Notice tone="error">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span>{failed().message}</span>
                      <button
                        type="button"
                        onClick={() => void createNew()}
                        class={cn(btnSecondary, "min-h-9 px-3 text-sm")}
                      >
                        <IconRefresh aria-hidden="true" class="size-4" />
                        Try again
                      </button>
                    </div>
                  </Notice>
                )}
              </Match>
              <Match when={requestId()} keyed>
                {(id) => (
                  <RequestShare
                    id={id}
                    businessName={info()?.businessName || "Your business"}
                    logo={info()?.logo}
                    prompt={prompt()}
                    onPrompt={changePrompt}
                    announce={announce}
                  />
                )}
              </Match>
            </Switch>

            <PhonePreview
              business={info()}
              customerName={customerName()}
              text={text()}
            />
          </aside>
        </div>
      </div>
    </>
  );
}

function SaveStatus(props: { state: SaveState; onRetry: () => void }) {
  return (
    <p role="status" class="flex items-center gap-2 text-sm text-text-muted">
      <Switch>
        <Match when={props.state === "pending" || props.state === "saving"}>
          <Spinner class="size-4" />
          Saving…
        </Match>
        <Match when={props.state === "saved"}>
          <IconCheck aria-hidden="true" class="size-4 text-success" />
          All changes saved to this link
        </Match>
        <Match when={props.state === "invalid"}>
          <IconAlertTriangle aria-hidden="true" class="size-4 text-warning" />
          Fix the highlighted field to save
        </Match>
        <Match when={props.state === "error"}>
          <IconAlertTriangle aria-hidden="true" class="size-4 text-error" />
          <span class="text-text">Couldn't save your changes.</span>
          <button
            type="button"
            onClick={() => props.onRetry()}
            class="min-h-11 font-medium text-primary underline underline-offset-4"
          >
            Retry
          </button>
        </Match>
      </Switch>
    </p>
  );
}

/** Same footprint as the ready ticket, so the preview doesn't jump. */
function ShareSkeleton() {
  return (
    <div
      aria-busy="true"
      class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <span class="sr-only">Creating your review link…</span>
      <div class="flex items-center gap-4">
        <Skeleton class="size-28 shrink-0" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-5 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton class="h-11 w-full" />
      <div class="grid grid-cols-2 gap-2">
        <Skeleton class="h-11" />
        <Skeleton class="h-11" />
      </div>
    </div>
  );
}

function RequestShare(props: {
  id: string;
  businessName: string;
  /** Drawn in the middle of the code on the ticket, the PNG and the sheet. */
  logo?: string | null;
  prompt: string;
  onPrompt: (value: string) => void;
  announce: (message: string) => void;
}) {
  // An emptied field falls back to the default on the ticket and sheet.
  const shownPrompt = () => props.prompt.trim() || PROMPT_DEFAULT;
  const [link, setLink] = createSignal("");
  const [qr, setQr] = createSignal("");
  const [problem, setProblem] = createSignal<string>();
  const [canShare, setCanShare] = createSignal(false);
  let linkField: HTMLInputElement | undefined;

  onMount(() => {
    setLink(reviewLink(props.id));
    setQr(qrLink(props.id));
    setCanShare(typeof navigator.share === "function");
  });

  async function download() {
    try {
      await downloadQrPng({
        url: qr(),
        filename: `flonion-review-qr-${props.id}.png`,
        prompt: shownPrompt(),
        logo: props.logo,
      });
      setProblem(undefined);
      props.announce("QR code downloaded");
    } catch {
      setProblem("We couldn't create the PNG. Try again, or print the sheet.");
    }
  }

  async function print() {
    const opened = await printQrSheet({
      url: qr(),
      link: link(),
      business: props.businessName,
      prompt: shownPrompt(),
      logo: props.logo,
    }).catch(() => false);
    setProblem(
      opened
        ? undefined
        : "Your browser blocked the print window. Allow pop-ups for Flonion and try again.",
    );
  }

  async function share() {
    try {
      await navigator.share({
        title: `Review ${props.businessName}`,
        text: `We'd love to hear about your visit to ${props.businessName}.`,
        url: link(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setProblem("Sharing didn't work here. Copy the link instead.");
    }
  }

  return (
    <div class="flex flex-col gap-3 animate-in fade-in-0 duration-[var(--duration-fast)] motion-safe:zoom-in-95">
      <Show when={qr()}>
        <QrTicket
          business={props.businessName}
          prompt={shownPrompt()}
          url={qr()}
          logo={props.logo}
        />
      </Show>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <label for="rn-prompt" class={labelClass}>
            Text on the QR
          </label>
          <span class="font-mono text-xs text-text-muted tabular-nums">
            {props.prompt.length} / {PROMPT_MAX}
          </span>
        </div>
        <input
          id="rn-prompt"
          type="text"
          autocomplete="off"
          maxLength={PROMPT_MAX}
          placeholder={PROMPT_DEFAULT}
          value={props.prompt}
          onInput={(e) => props.onPrompt(e.currentTarget.value)}
          aria-describedby="rn-prompt-hint"
          class={inputBase}
        />
        <p id="rn-prompt-hint" class="text-xs text-text-muted">
          Shown under your business name on the ticket and printed sheet.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rn-link" class={labelClass}>
          Review link
        </label>
        <input
          ref={linkField}
          id="rn-link"
          type="text"
          readOnly
          value={link()}
          onFocus={(e) => e.currentTarget.select()}
          aria-describedby="rn-link-hint"
          class={cn(inputBase, "font-mono text-sm")}
        />
        <p id="rn-link-hint" class="text-xs text-text-muted">
          The QR opens <span class="font-mono break-all">{qr()}</span>
        </p>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyButton
          value={link()}
          label="Copy link"
          copiedMessage="Link copied"
          announce={props.announce}
          onFailed={() => {
            setProblem(
              "We couldn't copy automatically. The link is selected, so copy it with your keyboard or long-press.",
            );
            linkField?.focus();
          }}
          class="w-full px-3 text-sm"
        />
        <Show when={canShare()}>
          <ActionButton
            icon={IconShare}
            onClick={share}
            class="w-full px-3 text-sm"
          >
            Share
          </ActionButton>
        </Show>
        <ActionButton
          icon={IconDownload}
          onClick={download}
          class="w-full px-3 text-sm"
        >
          Download QR (PNG)
        </ActionButton>
        <ActionButton
          icon={IconPrinter}
          onClick={print}
          class="w-full px-3 text-sm"
        >
          Print QR sheet
        </ActionButton>
      </div>

      <Show when={problem()}>
        {(msg) => <Notice tone="error">{msg()}</Notice>}
      </Show>
    </div>
  );
}
