import {
  IconArrowLeft,
  IconCircleCheck,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createEffect,
  createSignal,
  For,
  Index,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  FieldError,
  focusRing,
  inputBase,
  labelClass,
  textLink,
} from "~/components/auth/AuthShell";
import { QrTicket } from "~/components/landing/brand";
import {
  BUSINESS_NAME_MAX,
  DESCRIPTION_MAX,
  isHttpUrl,
  KEYWORD_MAX_LENGTH,
  KEYWORDS_MAX,
  phoneProblem,
  SECTORS,
  USERNAME_MAX,
  usernameProblem,
} from "~/features/settings/business-fields";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import { cn } from "~/lib/cn";
import { ROLE_DEFINITIONS } from "~/lib/roles";
import { toSlug } from "~/lib/slug";
import {
  ActionBar,
  api,
  btnPrimary,
  btnSecondary,
  CopyButton,
  cardClass,
  HelpPopover,
  NETWORK_ERROR,
  Notice,
  SelectField,
  Spinner,
  StepHeading,
  Stepper,
  stepEnter,
} from "./ui";

/* ------------------------------------------------------------------ draft */

const DRAFT_KEY = "flonion:onboarding-draft:v1";

const SECTOR_OPTIONS = SECTORS.map((s) => ({ value: s, label: s }));

const ROLE_OPTIONS = ROLE_DEFINITIONS.map((r) => ({
  value: r.value,
  label: r.label,
  description: r.description,
}));

export type Draft = {
  step: 1 | 2 | 3;
  name: string;
  sector: string;
  phone: string;
  address: string;
  username: string;
  /** Once the owner types a username we stop deriving it from the name. */
  usernameEdited: boolean;
  links: Record<string, string>;
  keywords: string[];
  description: string;
};

function emptyDraft(): Draft {
  return {
    step: 1,
    name: "",
    sector: "",
    phone: "",
    address: "",
    username: "",
    usernameEdited: false,
    links: {},
    keywords: [],
    description: "",
  };
}

/** Progress survives a refresh or the Google OAuth round-trip. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return { ...emptyDraft(), ...parsed };
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

/* ------------------------------------------------------------ validation */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UsernameState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; message: string }
  | { kind: "error" };

/* ---------------------------------------------------------------- wizard */

type Phase = 1 | 2 | 3 | 4 | "done";

export function BusinessWizard(props: {
  /** `?connected=true` / `?google=…` after the OAuth round-trip. */
  googleResult: "connected" | "failed" | null;
  onExit: () => void;
  /** Opened by a click (not a page load): move focus to the step heading. */
  autoFocus?: boolean;
}) {
  const initial = loadDraft() ?? emptyDraft();
  const [draft, setDraft] = createStore<Draft>(initial);
  const [phase, setPhase] = createSignal<Phase>(
    props.googleResult ? 2 : initial.step,
  );
  const [direction, setDirection] = createSignal<"forward" | "back">("forward");
  const [navigated, setNavigated] = createSignal(Boolean(props.autoFocus));
  const [saved, setSaved] = createSignal<{ name: string; username: string }>();
  const [origin, setOrigin] = createSignal("");

  onMount(() => setOrigin(window.location.origin));

  createEffect(() => {
    const p = phase();
    if (typeof p !== "number" || p > 3) return;
    const snapshot = JSON.stringify({
      ...draft,
      links: { ...draft.links },
      step: p,
    });
    try {
      localStorage.setItem(DRAFT_KEY, snapshot);
    } catch {}
  });

  function go(next: Phase) {
    const order = (p: Phase) => (p === "done" ? 5 : p);
    setDirection(order(next) >= order(phase()) ? "forward" : "back");
    setNavigated(true);
    setPhase(next);
    window.scrollTo({ top: 0 });
  }

  /* username availability (shared by steps 1 and 3) */
  const [usernameState, setUsernameState] = createSignal<UsernameState>({
    kind: "idle",
  });
  let checkSeq = 0;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(checkTimer));

  async function checkUsername(): Promise<UsernameState> {
    clearTimeout(checkTimer);
    const value = draft.username;
    const seq = ++checkSeq;
    if (!value) {
      const idle = { kind: "idle" } as const;
      setUsernameState(idle);
      return idle;
    }
    const problem = usernameProblem(value);
    if (problem) {
      const bad = { kind: "unavailable", message: problem } as const;
      setUsernameState(bad);
      return bad;
    }
    setUsernameState({ kind: "checking" });
    try {
      const { data } = await api<{ available: boolean }>("/api/business", {
        method: "PATCH",
        body: { username: value },
      });
      const next: UsernameState = data.available
        ? { kind: "available" }
        : {
            kind: "unavailable",
            message: data.error ?? "That username isn't available.",
          };
      if (seq === checkSeq) setUsernameState(next);
      return next;
    } catch {
      const err = { kind: "error" } as const;
      if (seq === checkSeq) setUsernameState(err);
      return err;
    }
  }

  function scheduleUsernameCheck() {
    clearTimeout(checkTimer);
    setUsernameState(draft.username ? { kind: "checking" } : { kind: "idle" });
    checkTimer = setTimeout(checkUsername, 450);
  }

  // A draft restored with a username gets re-checked once.
  onMount(() => {
    if (draft.username) void checkUsername();
  });

  const stepNumber = () => {
    const p = phase();
    return p === "done" ? 4 : p;
  };

  return (
    <div>
      <Show when={phase() !== "done"}>
        <Stepper current={stepNumber()} />
      </Show>

      <Switch>
        <Match when={phase() === 1}>
          <div class={stepEnter(direction())}>
            <StepBasics
              draft={draft}
              setDraft={setDraft}
              origin={origin()}
              focusHeading={navigated()}
              usernameState={usernameState()}
              onUsernameInput={scheduleUsernameCheck}
              onUsernameBlur={() => void checkUsername()}
              checkUsername={checkUsername}
              onBack={props.onExit}
              onNext={() => go(2)}
            />
          </div>
        </Match>
        <Match when={phase() === 2}>
          <div class={stepEnter(direction())}>
            <StepPlatforms
              draft={draft}
              setDraft={setDraft}
              googleResult={props.googleResult}
              focusHeading={navigated() || Boolean(props.googleResult)}
              onBack={() => go(1)}
              onNext={() => go(3)}
            />
          </div>
        </Match>
        <Match when={phase() === 3}>
          <div class={stepEnter(direction())}>
            <StepSettings
              draft={draft}
              setDraft={setDraft}
              focusHeading={navigated()}
              onBack={() => go(2)}
              onUsernameRejected={(message) => {
                setUsernameState({ kind: "unavailable", message });
                go(1);
              }}
              onLinksRejected={() => go(2)}
              onSaved={(business) => {
                clearDraft();
                setSaved(business);
                go(4);
              }}
            />
          </div>
        </Match>
        <Match when={phase() === 4}>
          <div class={stepEnter(direction())}>
            <StepInvite focusHeading={navigated()} onDone={() => go("done")} />
          </div>
        </Match>
        <Match when={phase() === "done"}>
          <div class={stepEnter("forward")}>
            <Finish
              name={saved()?.name ?? draft.name}
              reviewUrl={
                saved()?.username
                  ? `${origin()}/company/${saved()?.username}/review`
                  : null
              }
            />
          </div>
        </Match>
      </Switch>
    </div>
  );
}

type DraftSetter = ReturnType<typeof createStore<Draft>>[1];

/* ---------------------------------------------------- step 1: basics */

function StepBasics(props: {
  draft: Draft;
  setDraft: DraftSetter;
  origin: string;
  focusHeading: boolean;
  usernameState: UsernameState;
  onUsernameInput: () => void;
  onUsernameBlur: () => void;
  checkUsername: () => Promise<UsernameState>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = createSignal<{
    name?: string;
    phone?: string;
    username?: string;
  }>({});
  const [continuing, setContinuing] = createSignal(false);
  const refs: Partial<Record<"name" | "phone" | "username", HTMLInputElement>> =
    {};

  const usernameMessage = () =>
    errors().username ??
    (props.usernameState.kind === "unavailable"
      ? props.usernameState.message
      : undefined);

  const suggestions = () => {
    const base = props.draft.username.replace(/-+$/, "");
    if (props.usernameState.kind !== "unavailable" || !base) return [];
    if (usernameProblem(base)) return [];
    const fit = (suffix: string) =>
      `${base.slice(0, USERNAME_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    return [fit("-hq"), fit("-in"), fit("-2")].filter((s) => s !== base);
  };

  function deriveUsername() {
    if (props.draft.usernameEdited) return;
    const slug = toSlug(props.draft.name)
      .slice(0, USERNAME_MAX)
      .replace(/-+$/, "");
    if (slug === props.draft.username) return;
    props.setDraft("username", slug);
    if (slug) props.onUsernameBlur();
  }

  async function next(event: SubmitEvent) {
    event.preventDefault();
    if (continuing()) return;
    const found: ReturnType<typeof errors> = {};
    if (!props.draft.name.trim()) found.name = "Enter your business name.";
    const phone = phoneProblem(props.draft.phone);
    if (phone) found.phone = phone;

    setContinuing(true);
    try {
      if (props.draft.username) {
        const state =
          props.usernameState.kind === "available"
            ? props.usernameState
            : await props.checkUsername();
        if (state.kind === "unavailable") found.username = state.message;
        if (state.kind === "error")
          found.username =
            "We couldn't check this username. Try again in a moment.";
      }
    } finally {
      setContinuing(false);
    }

    setErrors(found);
    const first = (["name", "phone", "username"] as const).find(
      (f) => found[f],
    );
    if (first) {
      refs[first]?.focus();
      return;
    }
    props.onNext();
  }

  return (
    <form novalidate onSubmit={next} class={cardClass}>
      <StepHeading
        title="Tell us about your business"
        lead="This is what customers see when they scan your QR code."
        focusOnMount={props.focusHeading}
      />

      <div class="mt-6 flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label for="ob-name" class={labelClass}>
            Business name
          </label>
          <input
            ref={(el) => {
              refs.name = el;
            }}
            id="ob-name"
            type="text"
            autocomplete="organization"
            maxlength={BUSINESS_NAME_MAX}
            required
            placeholder="Swaad Restaurant"
            value={props.draft.name}
            onInput={(e) => {
              props.setDraft("name", e.currentTarget.value);
              if (errors().name) setErrors((f) => ({ ...f, name: undefined }));
            }}
            onBlur={() => {
              if (!props.draft.name.trim())
                setErrors((f) => ({ ...f, name: "Enter your business name." }));
              deriveUsername();
            }}
            aria-invalid={Boolean(errors().name)}
            aria-describedby={errors().name ? "ob-name-error" : undefined}
            class={inputBase}
          />
          <FieldError id="ob-name-error" message={errors().name} />
        </div>

        <SelectField
          label={
            <>
              Type of business{" "}
              <span class="font-normal text-text-muted">(optional)</span>
            </>
          }
          options={SECTOR_OPTIONS}
          value={props.draft.sector}
          onChange={(value) => props.setDraft("sector", value)}
          deselectable
        />

        <div class="grid gap-5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label for="ob-phone" class={labelClass}>
              Phone <span class="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              ref={(el) => {
                refs.phone = el;
              }}
              id="ob-phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+91 98765 43210"
              value={props.draft.phone}
              onInput={(e) => {
                props.setDraft("phone", e.currentTarget.value);
                if (errors().phone)
                  setErrors((f) => ({ ...f, phone: undefined }));
              }}
              onBlur={() =>
                setErrors((f) => ({
                  ...f,
                  phone: phoneProblem(props.draft.phone) ?? undefined,
                }))
              }
              aria-invalid={Boolean(errors().phone)}
              aria-describedby={errors().phone ? "ob-phone-error" : undefined}
              class={cn(inputBase, "tabular-nums")}
            />
            <FieldError id="ob-phone-error" message={errors().phone} />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="ob-address" class={labelClass}>
              City or address{" "}
              <span class="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="ob-address"
              type="text"
              autocomplete="street-address"
              placeholder="Koregaon Park, Pune"
              value={props.draft.address}
              onInput={(e) => props.setDraft("address", e.currentTarget.value)}
              class={inputBase}
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="ob-username" class={labelClass}>
            Review link name
          </label>
          <div class="flex items-stretch">
            <span
              aria-hidden="true"
              class="hidden shrink-0 items-center rounded-l-sm border border-r-0 border-border-strong bg-background px-3 font-mono text-sm whitespace-nowrap text-text-muted sm:flex"
            >
              /company/
            </span>
            <input
              ref={(el) => {
                refs.username = el;
              }}
              id="ob-username"
              type="text"
              autocapitalize="none"
              autocomplete="off"
              spellcheck={false}
              maxlength={USERNAME_MAX}
              placeholder="swaad"
              value={props.draft.username}
              onInput={(e) => {
                const value = e.currentTarget.value
                  .toLowerCase()
                  .replace(/\s+/g, "-");
                e.currentTarget.value = value;
                props.setDraft({ username: value, usernameEdited: true });
                setErrors((f) => ({ ...f, username: undefined }));
                props.onUsernameInput();
              }}
              onBlur={() => props.onUsernameBlur()}
              aria-invalid={Boolean(usernameMessage())}
              aria-describedby="ob-username-status ob-username-hint"
              class={cn(
                inputBase,
                "min-w-0 flex-1 font-mono sm:rounded-l-none",
              )}
            />
          </div>

          <p id="ob-username-status" aria-live="polite" class="min-h-6 text-sm">
            <Switch>
              <Match when={usernameMessage()}>
                {(message) => (
                  <span class="flex items-center gap-1.5 text-error">
                    <IconX aria-hidden="true" class="size-4 shrink-0" />
                    {message()}
                  </span>
                )}
              </Match>
              <Match when={props.usernameState.kind === "checking"}>
                <span class="flex items-center gap-1.5 text-text-muted">
                  <Spinner class="size-4" />
                  Checking availability…
                </span>
              </Match>
              <Match when={props.usernameState.kind === "available"}>
                <span class="flex items-center gap-1.5 text-success">
                  <IconCircleCheck aria-hidden="true" class="size-4 shrink-0" />
                  <span>
                    <span class="font-mono">{props.draft.username}</span> is
                    available
                  </span>
                </span>
              </Match>
              <Match when={props.usernameState.kind === "error"}>
                <span class="text-text-muted">
                  We couldn't check availability right now. We'll try again when
                  you continue.
                </span>
              </Match>
            </Switch>
          </p>

          <Show when={suggestions().length > 0}>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="text-text-muted">Try:</span>
              <For each={suggestions()}>
                {(s) => (
                  <button
                    type="button"
                    onClick={() => {
                      props.setDraft({ username: s, usernameEdited: true });
                      props.onUsernameBlur();
                    }}
                    class={cn(
                      "min-h-9 rounded-sm bg-primary-soft px-2.5 font-mono text-primary hover:brightness-95",
                      focusRing,
                    )}
                  >
                    {s}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <p id="ob-username-hint" class="text-sm text-text-muted">
            Lowercase letters, numbers, and hyphens. You can skip this and add
            it later in Settings.
          </p>

          <Show when={props.draft.username && props.origin}>
            <div class="mt-1 flex items-center gap-2 rounded-md border border-border bg-background py-1 pr-1 pl-3">
              <span class="min-w-0 flex-1 truncate font-mono text-sm text-text-muted">
                {props.origin.replace(/^https?:\/\//, "")}/company/
                <span class="text-text">{props.draft.username}</span>/review
              </span>
              <CopyButton
                value={`${props.origin}/company/${props.draft.username}/review`}
                label="Copy link"
                announce="Link copied"
              />
            </div>
          </Show>
        </div>
      </div>

      <ActionBar>
        <button type="button" onClick={props.onBack} class={btnSecondary}>
          <IconArrowLeft aria-hidden="true" class="size-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={continuing()}
          class={cn(
            btnPrimary,
            "ml-auto flex-1 sm:flex-none disabled:cursor-progress",
          )}
        >
          <Show when={continuing()}>
            <Spinner />
          </Show>
          Continue
        </button>
      </ActionBar>
    </form>
  );
}

/* ------------------------------------------------- step 2: platforms */

function StepPlatforms(props: {
  draft: Draft;
  setDraft: DraftSetter;
  googleResult: "connected" | "failed" | null;
  focusHeading: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [google, setGoogle] = createSignal<
    "loading" | "connected" | "disconnected" | "unknown"
  >("loading");
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const refs: Record<string, HTMLInputElement> = {};

  onMount(async () => {
    try {
      const { ok, data } = await api<{ connected: boolean }>(
        "/api/google/status",
      );
      setGoogle(
        ok ? (data.connected ? "connected" : "disconnected") : "unknown",
      );
    } catch {
      setGoogle("unknown");
    }
  });

  const hasLinks = () =>
    Object.values(props.draft.links).some((v) => v?.trim());

  function validate(slug: string) {
    const value = props.draft.links[slug]?.trim() ?? "";
    setErrors((e) => ({
      ...e,
      [slug]:
        value && !isHttpUrl(value)
          ? "Paste the full link, starting with https://"
          : "",
    }));
  }

  function next(event: SubmitEvent) {
    event.preventDefault();
    for (const p of REVIEW_PLATFORMS) validate(p.slug);
    const bad = REVIEW_PLATFORMS.find((p) => errors()[p.slug]);
    if (bad) {
      refs[bad.slug]?.focus();
      return;
    }
    props.onNext();
  }

  return (
    <form novalidate onSubmit={next} class={cardClass}>
      <StepHeading
        title="Where should customers post reviews?"
        lead="Every customer sees the same options, whatever rating they give."
        focusOnMount={props.focusHeading}
      />

      <div class="mt-6 flex flex-col gap-5">
        <Show
          when={props.googleResult === "failed" && google() !== "connected"}
        >
          <Notice tone="warning">
            <span class="font-medium">Google isn't connected.</span> You can do
            this later from Settings.
          </Notice>
        </Show>

        <section
          aria-labelledby="ob-google-title"
          class="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center"
        >
          <span
            aria-hidden="true"
            class="grid size-11 shrink-0 place-items-center rounded-md bg-surface font-display text-lg font-semibold text-primary"
          >
            G
          </span>
          <div class="min-w-0 flex-1">
            <h3
              id="ob-google-title"
              class="font-display text-base font-semibold text-text"
            >
              Google Business Profile
            </h3>
            <p class="text-sm text-text-muted">
              Connect to see your rating and reply to Google reviews in Flonion.
            </p>
          </div>
          <Switch>
            <Match when={google() === "loading"}>
              <span class="flex min-h-11 items-center gap-2 text-sm text-text-muted">
                <Spinner class="size-4" />
                Checking…
              </span>
            </Match>
            <Match when={google() === "connected"}>
              <span class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-success">
                <IconCircleCheck aria-hidden="true" class="size-4" />
                Connected
              </span>
            </Match>
            <Match when={google() === "disconnected" || google() === "unknown"}>
              <a
                href="/api/google/auth?returnTo=/onboarding"
                class={btnSecondary}
              >
                Connect Google
              </a>
            </Match>
          </Switch>
        </section>

        <Index each={REVIEW_PLATFORMS}>
          {(platform) => {
            const slug = platform().slug;
            const id = `ob-link-${slug}`;
            return (
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between gap-2">
                  <label for={id} class={labelClass}>
                    {platform().label} review link
                  </label>
                  <HelpPopover
                    title={`Finding your ${platform().label} link`}
                    body={platform().help}
                  />
                </div>
                <input
                  ref={(el) => {
                    refs[slug] = el;
                  }}
                  id={id}
                  type="url"
                  inputmode="url"
                  autocapitalize="none"
                  spellcheck={false}
                  placeholder={platform().placeholder}
                  value={props.draft.links[slug] ?? ""}
                  onInput={(e) => {
                    props.setDraft("links", slug, e.currentTarget.value);
                    if (errors()[slug])
                      setErrors((f) => ({ ...f, [slug]: "" }));
                  }}
                  onBlur={() => validate(slug)}
                  aria-invalid={Boolean(errors()[slug])}
                  aria-describedby={errors()[slug] ? `${id}-error` : undefined}
                  class={inputBase}
                />
                <FieldError id={`${id}-error`} message={errors()[slug]} />
              </div>
            );
          }}
        </Index>

        <Show when={!hasLinks()}>
          <Notice tone="warning">
            Add at least one platform so customers know where to post. You can
            continue and add links later.
          </Notice>
        </Show>
      </div>

      <ActionBar>
        <button type="button" onClick={props.onBack} class={btnSecondary}>
          <IconArrowLeft aria-hidden="true" class="size-4" />
          Back
        </button>
        <button
          type="submit"
          class={cn(btnPrimary, "ml-auto flex-1 sm:flex-none")}
        >
          Continue
        </button>
      </ActionBar>
    </form>
  );
}

/* -------------------------------------------------- step 3: settings */

function StepSettings(props: {
  draft: Draft;
  setDraft: DraftSetter;
  focusHeading: boolean;
  onBack: () => void;
  onUsernameRejected: (message: string) => void;
  onLinksRejected: () => void;
  onSaved: (business: { name: string; username: string }) => void;
}) {
  const [keyword, setKeyword] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let keywordInput: HTMLInputElement | undefined;
  let errorRef: HTMLDivElement | undefined;

  function addKeyword(raw: string) {
    const parts = raw
      .split(",")
      .map((k) => k.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (!parts.length) return;
    props.setDraft(
      produce((d) => {
        for (const k of parts) {
          if (d.keywords.length >= KEYWORDS_MAX) break;
          if (!d.keywords.some((x) => x.toLowerCase() === k.toLowerCase()))
            d.keywords.push(k.slice(0, KEYWORD_MAX_LENGTH));
        }
      }),
    );
    setKeyword("");
  }

  function removeKeyword(index: number) {
    props.setDraft("keywords", (list) => list.filter((_, i) => i !== index));
    keywordInput?.focus();
  }

  const onKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keyword());
    } else if (
      e.key === "Backspace" &&
      !keyword() &&
      props.draft.keywords.length
    ) {
      props.setDraft("keywords", (list) => list.slice(0, -1));
    }
  };

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving()) return;
    if (keyword().trim()) addKeyword(keyword());
    setError(null);
    setSaving(true);

    const links = Object.fromEntries(
      Object.entries(props.draft.links)
        .map(([k, v]) => [k, v?.trim() ?? ""])
        .filter(([, v]) => v),
    );

    try {
      const { ok, status, data } = await api<{
        businessName: string;
        username: string;
      }>("/api/business", {
        method: "POST",
        body: {
          businessName: props.draft.name.trim(),
          sector: props.draft.sector,
          phone: props.draft.phone.trim(),
          address: props.draft.address.trim(),
          username: props.draft.username,
          reviewLinks: links,
          reviewLink: links.google ?? Object.values(links)[0] ?? "",
          keywords: props.draft.keywords.join(", "),
          description: props.draft.description,
        },
      });

      if (status === 401) {
        window.location.assign("/login?callbackURL=/onboarding");
        return;
      }
      if (!ok) {
        const message = data.error ?? "We couldn't save your business.";
        if (/username/i.test(message)) return props.onUsernameRejected(message);
        if (/link must be/i.test(message)) {
          props.onLinksRejected();
          return;
        }
        if (/business name/i.test(message)) {
          setError("Go back to step 1 and enter your business name.");
        } else setError(message);
        queueMicrotask(() => errorRef?.focus());
        return;
      }

      props.onSaved({
        name: data.businessName ?? props.draft.name,
        username: data.username ?? "",
      });
    } catch {
      setError(NETWORK_ERROR);
      queueMicrotask(() => errorRef?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form novalidate onSubmit={save} class={cardClass}>
      <StepHeading
        title="Review settings"
        lead="Keywords help AI suggestions mention what your business is known for."
        focusOnMount={props.focusHeading}
      />

      <div ref={errorRef} tabindex="-1" class="outline-none">
        <Show when={error()}>
          <Notice tone="error" class="mt-5">
            {error()}
          </Notice>
        </Show>
      </div>

      <div class="mt-6 flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label for="ob-keywords" class={labelClass}>
            Keywords <span class="font-normal text-text-muted">(optional)</span>
          </label>
          <div class="flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2 py-1.5 focus-within:border-primary focus-within:outline-2 focus-within:outline-primary">
            <ul class="contents" aria-label="Added keywords">
              <For each={props.draft.keywords}>
                {(k, i) => (
                  <li class="inline-flex items-center gap-1 rounded-sm bg-primary-soft py-1 pl-2.5 text-sm text-primary">
                    {k}
                    <button
                      type="button"
                      onClick={() => removeKeyword(i())}
                      aria-label={`Remove ${k}`}
                      class={cn(
                        "grid size-7 place-items-center rounded-sm hover:bg-primary/10",
                        focusRing,
                      )}
                    >
                      <IconX aria-hidden="true" class="size-3.5" />
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <input
              ref={keywordInput}
              id="ob-keywords"
              type="text"
              enterkeyhint="enter"
              disabled={props.draft.keywords.length >= KEYWORDS_MAX}
              placeholder={
                props.draft.keywords.length
                  ? "Add another"
                  : "biryani, family dining"
              }
              value={keyword()}
              onInput={(e) => {
                const v = e.currentTarget.value;
                if (v.includes(",")) addKeyword(v);
                else setKeyword(v);
              }}
              onKeyDown={onKeyDown}
              onBlur={() => addKeyword(keyword())}
              aria-describedby="ob-keywords-hint"
              class="min-h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-base text-text outline-none placeholder:text-text-muted/80 disabled:cursor-not-allowed"
            />
          </div>
          <p id="ob-keywords-hint" class="text-sm text-text-muted">
            Press Enter or comma to add.{" "}
            <span class="font-mono tabular-nums">
              {props.draft.keywords.length}
            </span>{" "}
            of <span class="font-mono tabular-nums">{KEYWORDS_MAX}</span>.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="ob-description" class={labelClass}>
            Short description{" "}
            <span class="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            id="ob-description"
            rows={3}
            maxlength={DESCRIPTION_MAX}
            placeholder="Family-run North Indian kitchen serving Pune since 2009."
            value={props.draft.description}
            onInput={(e) =>
              props.setDraft("description", e.currentTarget.value)
            }
            aria-describedby="ob-description-hint"
            class={cn(inputBase, "min-h-24 resize-y py-2.5")}
          />
          <p id="ob-description-hint" class="text-sm text-text-muted">
            Shown on your marketplace profile.{" "}
            <span class="font-mono tabular-nums">
              {props.draft.description.length}/{DESCRIPTION_MAX}
            </span>
          </p>
        </div>
      </div>

      <ActionBar>
        <button type="button" onClick={props.onBack} class={btnSecondary}>
          <IconArrowLeft aria-hidden="true" class="size-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={saving()}
          class={cn(
            btnPrimary,
            "ml-auto flex-1 sm:flex-none disabled:cursor-progress disabled:opacity-80",
          )}
        >
          <Show when={saving()} fallback="Save and continue">
            <Spinner />
            Saving…
          </Show>
        </button>
      </ActionBar>
    </form>
  );
}

/* ---------------------------------------------------- step 4: invite */

type InviteRow = {
  id: number;
  email: string;
  role: string;
  status: "idle" | "sending" | "sent" | "error";
  message?: string;
};

function StepInvite(props: { focusHeading: boolean; onDone: () => void }) {
  let nextId = 1;
  const newRow = (): InviteRow => ({
    id: nextId++,
    email: "",
    role: "member",
    status: "idle",
  });
  const [rows, setRows] = createStore<InviteRow[]>([newRow()]);
  const [sending, setSending] = createSignal(false);

  const pending = () =>
    rows.filter((r) => r.status !== "sent" && r.email.trim());
  const sentCount = () => rows.filter((r) => r.status === "sent").length;

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (sending()) return;
    if (!pending().length) {
      props.onDone();
      return;
    }

    let valid = true;
    for (const row of pending()) {
      if (!EMAIL_RE.test(row.email.trim())) {
        valid = false;
        setRows((r) => r.id === row.id, {
          status: "error",
          message: "Enter an email address like name@business.com.",
        });
      }
    }
    if (!valid) {
      document
        .querySelector<HTMLInputElement>(
          '[data-invite-email][aria-invalid="true"]',
        )
        ?.focus();
      return;
    }

    setSending(true);
    let failed = false;
    for (const row of pending()) {
      setRows((r) => r.id === row.id, {
        status: "sending",
        message: undefined,
      });
      try {
        const { ok, data } = await api("/api/team/invite", {
          method: "POST",
          body: { email: row.email.trim(), role: row.role },
        });
        if (ok) setRows((r) => r.id === row.id, { status: "sent" });
        else {
          failed = true;
          setRows((r) => r.id === row.id, {
            status: "error",
            message: data.error ?? "We couldn't send this invitation.",
          });
        }
      } catch {
        failed = true;
        setRows((r) => r.id === row.id, {
          status: "error",
          message: NETWORK_ERROR,
        });
      }
    }
    setSending(false);
    if (!failed) props.onDone();
  }

  return (
    <form novalidate onSubmit={send} class={cardClass}>
      <Notice tone="success">
        <span class="font-medium">Your business is saved.</span> Inviting your
        team is optional.
      </Notice>

      <div class="mt-6">
        <StepHeading
          title="Invite your team"
          lead="Teammates can reply to reviews, manage tasks, and share QR codes."
          focusOnMount={props.focusHeading}
        />
      </div>

      <ul class="mt-6 flex flex-col gap-4">
        <For each={rows}>
          {(row, i) => {
            const emailId = `ob-invite-email-${row.id}`;
            const errorId = `${emailId}-error`;
            return (
              <li class="flex flex-col gap-1.5">
                <div class="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9.5rem_auto]">
                  <div class="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                    <label
                      for={emailId}
                      class={cn(labelClass, i() > 0 && "sr-only")}
                    >
                      Email address
                    </label>
                    <input
                      id={emailId}
                      data-invite-email
                      type="email"
                      inputmode="email"
                      autocomplete="off"
                      autocapitalize="none"
                      spellcheck={false}
                      placeholder="teammate@business.com"
                      disabled={
                        row.status === "sent" || row.status === "sending"
                      }
                      value={row.email}
                      onInput={(e) =>
                        setRows((r) => r.id === row.id, {
                          email: e.currentTarget.value,
                          status: "idle",
                          message: undefined,
                        })
                      }
                      aria-invalid={row.status === "error"}
                      aria-describedby={
                        row.status === "error" ? errorId : undefined
                      }
                      class={cn(
                        inputBase,
                        "disabled:bg-background disabled:text-text-muted",
                      )}
                    />
                  </div>
                  <SelectField
                    label="Role"
                    hideLabel={i() > 0}
                    options={ROLE_OPTIONS}
                    value={row.role}
                    disabled={row.status === "sent" || row.status === "sending"}
                    onChange={(value) =>
                      setRows((r) => r.id === row.id, {
                        role: value || "member",
                      })
                    }
                  />
                  <div class="flex flex-col justify-end">
                    <Switch
                      fallback={
                        <button
                          type="button"
                          disabled={rows.length === 1}
                          onClick={() =>
                            setRows((list) =>
                              list.filter((r) => r.id !== row.id),
                            )
                          }
                          aria-label={`Remove ${row.email || "this row"}`}
                          class={cn(
                            "grid size-11 place-items-center rounded-md text-text-muted hover:bg-primary-soft hover:text-text disabled:invisible",
                            focusRing,
                          )}
                        >
                          <IconTrash aria-hidden="true" class="size-4" />
                        </button>
                      }
                    >
                      <Match when={row.status === "sending"}>
                        <span class="grid size-11 place-items-center text-text-muted">
                          <Spinner class="size-4" />
                          <span class="sr-only">Sending</span>
                        </span>
                      </Match>
                      <Match when={row.status === "sent"}>
                        <span class="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-success">
                          <IconCircleCheck aria-hidden="true" class="size-4" />
                          Sent
                        </span>
                      </Match>
                    </Switch>
                  </div>
                </div>
                <FieldError
                  id={errorId}
                  message={row.status === "error" ? row.message : undefined}
                />
              </li>
            );
          }}
        </For>
      </ul>

      <Show when={rows.length < 5}>
        <button
          type="button"
          onClick={() => setRows(rows.length, newRow())}
          class={cn(
            "mt-3 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm",
            textLink,
          )}
        >
          <IconPlus aria-hidden="true" class="size-4" />
          Add another
        </button>
      </Show>

      <p aria-live="polite" class="sr-only">
        {sentCount()
          ? `${sentCount()} invitation${sentCount() === 1 ? "" : "s"} sent`
          : ""}
      </p>

      <ActionBar>
        <button
          type="button"
          onClick={props.onDone}
          disabled={sending()}
          class={cn(btnSecondary, "border-transparent")}
        >
          {sentCount() ? "Continue" : "Skip for now"}
        </button>
        <button
          type="submit"
          disabled={sending()}
          class={cn(
            btnPrimary,
            "ml-auto flex-1 sm:flex-none disabled:cursor-progress disabled:opacity-80",
          )}
        >
          <Show
            when={sending()}
            fallback={pending().length ? "Send invites" : "Continue"}
          >
            <Spinner />
            Sending…
          </Show>
        </button>
      </ActionBar>
    </form>
  );
}

/* ------------------------------------------------------------- finish */

function Finish(props: { name: string; reviewUrl: string | null }) {
  return (
    <section class={cn(cardClass, "flex flex-col items-center text-center")}>
      <svg
        aria-hidden="true"
        viewBox="0 0 52 52"
        class="size-14 text-success"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="26" cy="26" r="23" class="opacity-20" />
        <path d="M15 27l7 7 15-16" class="check-draw" pathLength="1" />
      </svg>
      <h2
        ref={(el) => queueMicrotask(() => el.focus())}
        tabindex="-1"
        class="mt-4 font-display text-xl font-semibold text-text outline-none"
      >
        You're all set
      </h2>
      <p class="mt-2 max-w-[40ch] text-base text-text-muted">
        <Show
          when={props.reviewUrl}
          fallback="Add a review link name in Settings to get your QR code."
        >
          Print this QR code and place it where customers pay. Every scan opens
          your review page.
        </Show>
      </p>

      <Show when={props.reviewUrl}>
        {(url) => (
          <>
            <QrTicket
              business={props.name}
              prompt="Scan to share your experience"
              url={url()}
              class="mt-6 w-full max-w-[380px] text-left"
            />
            <div class="mt-3">
              <CopyButton
                value={url()}
                label="Copy review link"
                announce="Link copied"
              />
            </div>
          </>
        )}
      </Show>

      <a
        href="/dashboard"
        class={cn(btnPrimary, "mt-8 min-h-12 w-full sm:w-auto sm:px-8")}
      >
        Go to dashboard
      </a>
    </section>
  );
}

/* ----------------------------------------------------------- shared */

/** Copy & Share feedback (spec §4.3): icon swap, "Copied" for 2s, polite announcement. */
