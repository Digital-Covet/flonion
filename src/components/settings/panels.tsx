import {
  IconAlertTriangle,
  IconBrandGoogle,
  IconCircleCheck,
  IconExternalLink,
  IconPlugConnected,
  IconQrcode,
  IconX,
} from "@tabler/icons-solidjs";
import {
  createSignal,
  For,
  Index,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import {
  FieldError,
  focusRing,
  inputBase,
  labelClass,
} from "~/components/auth/AuthShell";
import {
  api,
  btnPrimary,
  btnSecondary,
  CopyButton,
  HelpPopover,
  Notice,
  SelectField,
  Spinner,
} from "~/components/onboarding/ui";
import {
  addKeywords,
  hasAnyLink,
  type SettingsField,
  type SettingsForm,
} from "~/components/settings/form";
import {
  ReadOnlyRow,
  SectionLink,
  SettingsSection,
} from "~/components/settings/ui";
import {
  BUSINESS_NAME_MAX,
  DESCRIPTION_MAX,
  KEYWORDS_MAX,
  SECTORS,
  USERNAME_MAX,
  usernameProblem,
} from "~/features/settings/business-fields";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import { cn } from "~/lib/cn";

const SECTOR_OPTIONS = SECTORS.map((s) => ({ value: s, label: s }));

/** Everything a panel needs from the page: the draft, and how to report a field. */
export type PanelProps = {
  form: SettingsForm;
  setForm: SetStoreFunction<SettingsForm>;
  errors: Partial<Record<SettingsField, string>>;
  clearError: (field: SettingsField) => void;
  setError: (field: SettingsField, message: string | undefined) => void;
  /** Invited members can read every setting but change none (enforced server-side). */
  readOnly: boolean;
  focusHeading: boolean;
};

/* ------------------------------------------------------- business profile */

export function ProfilePanel(props: PanelProps) {
  return (
    <SettingsSection
      id="profile"
      title="Business profile"
      lead="What customers see when they scan your QR code, and what partners see on the marketplace."
      focusHeading={props.focusHeading}
    >
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label for="set-name" class={labelClass}>
            Business name
          </label>
          <input
            id="set-name"
            type="text"
            autocomplete="organization"
            maxlength={BUSINESS_NAME_MAX}
            required
            disabled={props.readOnly}
            placeholder="Swaad Restaurant"
            value={props.form.businessName}
            onInput={(e) => {
              props.setForm("businessName", e.currentTarget.value);
              props.clearError("businessName");
            }}
            onBlur={() =>
              props.setError(
                "businessName",
                props.form.businessName.trim()
                  ? undefined
                  : "Enter your business name.",
              )
            }
            aria-invalid={Boolean(props.errors.businessName)}
            aria-describedby={
              props.errors.businessName ? "set-name-error" : undefined
            }
            class={inputBase}
          />
          <FieldError id="set-name-error" message={props.errors.businessName} />
        </div>

        <SelectField
          label={
            <>
              Type of business{" "}
              <span class="font-normal text-text-muted">(optional)</span>
            </>
          }
          options={SECTOR_OPTIONS}
          value={props.form.sector}
          onChange={(value) => props.setForm("sector", value)}
          disabled={props.readOnly}
          deselectable
        />

        <div class="grid gap-5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label for="set-phone" class={labelClass}>
              Phone <span class="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="set-phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              disabled={props.readOnly}
              placeholder="+91 98765 43210"
              value={props.form.phone}
              onInput={(e) => {
                props.setForm("phone", e.currentTarget.value);
                props.clearError("phone");
              }}
              aria-invalid={Boolean(props.errors.phone)}
              aria-describedby={
                props.errors.phone ? "set-phone-error" : undefined
              }
              class={cn(inputBase, "tabular-nums")}
            />
            <FieldError id="set-phone-error" message={props.errors.phone} />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="set-address" class={labelClass}>
              City or address{" "}
              <span class="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="set-address"
              type="text"
              autocomplete="street-address"
              disabled={props.readOnly}
              placeholder="Koregaon Park, Pune"
              value={props.form.address}
              onInput={(e) => props.setForm("address", e.currentTarget.value)}
              class={inputBase}
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="set-description" class={labelClass}>
            Short description{" "}
            <span class="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            id="set-description"
            rows={3}
            maxlength={DESCRIPTION_MAX}
            disabled={props.readOnly}
            placeholder="Family-run North Indian kitchen serving Pune since 2009."
            value={props.form.description}
            onInput={(e) => props.setForm("description", e.currentTarget.value)}
            aria-describedby="set-description-hint"
            class={cn(inputBase, "min-h-24 resize-y py-2.5")}
          />
          <p id="set-description-hint" class="text-sm text-text-muted">
            Shown on your marketplace profile.{" "}
            <span class="font-mono tabular-nums">
              {props.form.description.length}/{DESCRIPTION_MAX}
            </span>
          </p>
        </div>

        {/*
          The logo is edited with the rest of the public profile, next to the
          cover image and services it sits with. Showing it here read-only
          keeps this panel honest about what a customer sees, instead of
          leaving the one visual field silently missing.
        */}
        <div class="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Show
            when={props.form.logo}
            fallback={
              <span
                aria-hidden="true"
                class="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-primary-soft font-display text-lg font-semibold text-primary"
              >
                {props.form.businessName.trim().charAt(0).toUpperCase() || "?"}
              </span>
            }
          >
            {(logo) => (
              <img
                src={logo()}
                alt=""
                width="44"
                height="44"
                class="size-11 shrink-0 rounded-md border border-border object-cover"
              />
            )}
          </Show>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text">Logo</p>
            <p class="text-sm text-text-muted">
              <Show
                when={props.form.logo}
                fallback="No logo yet — customers see your first initial."
              >
                Shown on your review page and marketplace card.
              </Show>
            </p>
          </div>
          <Show when={!props.readOnly}>
            <SectionLink href="/marketplace/projects" label="Change logo" />
          </Show>
        </div>
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------ review link */

type UsernameState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; message: string }
  | { kind: "error" };

export function ReviewLinkPanel(
  props: PanelProps & {
    origin: string;
    profileHref: string | null;
    /**
     * The name currently stored on the business. Read from the loaded business
     * rather than captured from the draft at mount: this panel can render one
     * frame before the draft is seeded, and a captured empty string would make
     * the owner's own name look unavailable and about to be retired.
     */
    savedUsername: string;
  },
) {
  const [state, setState] = createSignal<UsernameState>({ kind: "idle" });
  const saved = () => props.savedUsername;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  /**
   * Availability is feedback only — `POST /api/business` re-checks it, and a
   * name claimed between the check and the save comes back as a field error.
   * The name already on the business is its own, so it is never "taken".
   */
  async function check() {
    clearTimeout(timer);
    const value = props.form.username;
    const mine = ++seq;
    if (!value || value === saved()) return setState({ kind: "idle" });

    const problem = usernameProblem(value);
    if (problem) return setState({ kind: "unavailable", message: problem });

    setState({ kind: "checking" });
    try {
      const { data } = await api<{ available: boolean }>("/api/business", {
        method: "PATCH",
        body: { username: value },
      });
      if (mine !== seq) return;
      setState(
        data.available
          ? { kind: "available" }
          : {
              kind: "unavailable",
              message: data.error ?? "That name isn't available.",
            },
      );
    } catch {
      if (mine === seq) setState({ kind: "error" });
    }
  }

  function onInput(value: string) {
    props.setForm("username", value);
    props.clearError("username");
    clearTimeout(timer);
    setState(
      value && value !== saved() ? { kind: "checking" } : { kind: "idle" },
    );
    timer = setTimeout(check, 450);
  }

  const message = () => {
    const s = state();
    return (
      props.errors.username ??
      (s.kind === "unavailable" ? s.message : undefined)
    );
  };

  const reviewUrl = () =>
    props.form.username && props.origin
      ? `${props.origin}/company/${props.form.username}/review`
      : "";

  return (
    <SettingsSection
      id="link"
      title="Review link"
      lead="The address behind your QR code. Changing it retires the old one, so reprint any QR sheets already on your counter."
      focusHeading={props.focusHeading}
      aside={
        <Show when={props.profileHref}>
          {(href) => <SectionLink href={href()} label="View public page" />}
        </Show>
      }
    >
      <div class="flex flex-col gap-1.5">
        <label for="set-username" class={labelClass}>
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
            id="set-username"
            type="text"
            autocapitalize="none"
            autocomplete="off"
            spellcheck={false}
            maxlength={USERNAME_MAX}
            disabled={props.readOnly}
            placeholder="swaad"
            value={props.form.username}
            onInput={(e) => {
              const value = e.currentTarget.value
                .toLowerCase()
                .replace(/\s+/g, "-");
              e.currentTarget.value = value;
              onInput(value);
            }}
            onBlur={() => void check()}
            aria-invalid={Boolean(message())}
            aria-describedby="set-username-status set-username-hint"
            class={cn(inputBase, "min-w-0 flex-1 font-mono sm:rounded-l-none")}
          />
        </div>

        <p id="set-username-status" aria-live="polite" class="min-h-6 text-sm">
          <Switch>
            <Match when={message()}>
              {(text) => (
                <span class="flex items-center gap-1.5 text-error">
                  <IconX aria-hidden="true" class="size-4 shrink-0" />
                  {text()}
                </span>
              )}
            </Match>
            <Match when={state().kind === "checking"}>
              <span class="flex items-center gap-1.5 text-text-muted">
                <Spinner class="size-4" />
                Checking availability…
              </span>
            </Match>
            <Match when={state().kind === "available"}>
              <span class="flex items-center gap-1.5 text-success">
                <IconCircleCheck aria-hidden="true" class="size-4 shrink-0" />
                <span>
                  <span class="font-mono">{props.form.username}</span> is
                  available
                </span>
              </span>
            </Match>
            <Match when={state().kind === "error"}>
              <span class="text-text-muted">
                We couldn't check availability right now. Saving will tell you
                for certain.
              </span>
            </Match>
          </Switch>
        </p>

        <p id="set-username-hint" class="text-sm text-text-muted">
          Lowercase letters, numbers, and hyphens.{" "}
          <span class="font-mono tabular-nums">
            {props.form.username.length}/{USERNAME_MAX}
          </span>
        </p>

        <Show
          when={reviewUrl()}
          fallback={
            <Notice tone="info" class="mt-2">
              Without a link name, customers reach you through a longer link
              built from your business id. Pick a short name so the address is
              easy to read on a printed QR sheet.
            </Notice>
          }
        >
          <div class="mt-2 flex items-center gap-2 rounded-md border border-border bg-background py-1 pr-1 pl-3">
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-text-muted">
              {props.origin.replace(/^https?:\/\//, "")}/company/
              <span class="text-text">{props.form.username}</span>/review
            </span>
            <CopyButton
              value={reviewUrl()}
              label="Copy link"
              announce="Link copied"
            />
          </div>
        </Show>

        <Show when={props.form.username !== saved() && saved()}>
          <Notice tone="warning" class="mt-2">
            Your old link{" "}
            <span class="font-mono">/company/{saved()}/review</span> stops
            working once you save. Printed QR codes that point at it will need
            reprinting.
          </Notice>
        </Show>

        <div class="mt-2">
          <SectionLink href="/reviews/new" label="Create a QR sheet" />
        </div>
      </div>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------- platforms */

export function PlatformsPanel(props: PanelProps) {
  return (
    <SettingsSection
      id="platforms"
      title="Review platforms"
      lead="Every customer sees the same options, whatever rating they give."
      focusHeading={props.focusHeading}
    >
      <div class="flex flex-col gap-5">
        <Index each={REVIEW_PLATFORMS}>
          {(platform) => {
            const slug = platform().slug;
            const field: SettingsField = `link:${slug}`;
            const id = `set-link-${slug}`;
            return (
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between gap-2">
                  <label for={id} class={labelClass}>
                    {platform().label} review link{" "}
                    <span class="font-normal text-text-muted">(optional)</span>
                  </label>
                  <HelpPopover
                    title={`Finding your ${platform().label} link`}
                    body={platform().help}
                  />
                </div>
                <input
                  id={id}
                  type="url"
                  inputmode="url"
                  autocapitalize="none"
                  spellcheck={false}
                  disabled={props.readOnly}
                  placeholder={platform().placeholder}
                  value={props.form.links[slug] ?? ""}
                  onInput={(e) => {
                    props.setForm("links", slug, e.currentTarget.value);
                    props.clearError(field);
                  }}
                  aria-invalid={Boolean(props.errors[field])}
                  aria-describedby={
                    props.errors[field] ? `${id}-error` : undefined
                  }
                  class={inputBase}
                />
                <FieldError id={`${id}-error`} message={props.errors[field]} />
              </div>
            );
          }}
        </Index>

        <Show when={!hasAnyLink(props.form)}>
          <Notice tone="warning">
            <span class="font-medium">No platforms yet.</span> Customers who
            finish a review have nowhere to post it. Add at least one link.
          </Notice>
        </Show>
      </div>
    </SettingsSection>
  );
}

/* --------------------------------------------------------- review settings */

export function ReviewSettingsPanel(props: PanelProps) {
  const [keyword, setKeyword] = createSignal("");
  let input: HTMLInputElement | undefined;

  function add(raw: string) {
    const next = addKeywords(props.form.keywords, raw);
    if (next.length !== props.form.keywords.length)
      props.setForm("keywords", next);
    setKeyword("");
  }

  function remove(index: number) {
    props.setForm("keywords", (list) => list.filter((_, i) => i !== index));
    input?.focus();
  }

  const onKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(keyword());
    } else if (
      e.key === "Backspace" &&
      !keyword() &&
      props.form.keywords.length
    ) {
      props.setForm("keywords", (list) => list.slice(0, -1));
    }
  };

  const full = () => props.form.keywords.length >= KEYWORDS_MAX;

  return (
    <SettingsSection
      id="keywords"
      title="Review settings"
      lead="Keywords tell the AI what your business is known for, so its suggestions sound like your shop rather than a generic one."
      focusHeading={props.focusHeading}
    >
      <div class="flex flex-col gap-1.5">
        <label for="set-keywords" class={labelClass}>
          Keywords <span class="font-normal text-text-muted">(optional)</span>
        </label>
        <div
          class={cn(
            "flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2 py-1.5 focus-within:border-primary focus-within:outline-2 focus-within:outline-primary",
            props.readOnly && "bg-background",
          )}
        >
          <ul class="contents" aria-label="Added keywords">
            <For each={props.form.keywords}>
              {(k, i) => (
                <li
                  class={cn(
                    "inline-flex items-center gap-1 rounded-sm bg-primary-soft py-1 text-sm text-primary",
                    props.readOnly ? "px-2.5" : "pl-2.5",
                  )}
                >
                  {k}
                  <Show when={!props.readOnly}>
                    <button
                      type="button"
                      onClick={() => remove(i())}
                      aria-label={`Remove ${k}`}
                      class={cn(
                        "grid size-7 place-items-center rounded-sm hover:bg-primary/10",
                        focusRing,
                      )}
                    >
                      <IconX aria-hidden="true" class="size-3.5" />
                    </button>
                  </Show>
                </li>
              )}
            </For>
          </ul>
          <Show when={!props.readOnly}>
            <input
              ref={input}
              id="set-keywords"
              type="text"
              enterkeyhint="enter"
              disabled={full()}
              placeholder={
                props.form.keywords.length
                  ? "Add another"
                  : "biryani, family dining"
              }
              value={keyword()}
              onInput={(e) => {
                const v = e.currentTarget.value;
                if (v.includes(",")) add(v);
                else setKeyword(v);
              }}
              onKeyDown={onKeyDown}
              onBlur={() => add(keyword())}
              aria-describedby="set-keywords-hint"
              class="min-h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-base text-text outline-none placeholder:text-text-muted/80 disabled:cursor-not-allowed"
            />
          </Show>
        </div>
        <p id="set-keywords-hint" class="text-sm text-text-muted">
          <Show when={!props.readOnly}>Press Enter or comma to add. </Show>
          <span class="font-mono tabular-nums">
            {props.form.keywords.length}
          </span>{" "}
          of <span class="font-mono tabular-nums">{KEYWORDS_MAX}</span>.
        </p>
        <Show when={full()}>
          <Notice tone="info" class="mt-1">
            That's the maximum. Remove one to add another — a short, honest list
            works better than a long one.
          </Notice>
        </Show>
      </div>

      <div class="mt-6 rounded-md border border-border bg-background p-4">
        <h3 class="font-display text-base font-semibold text-text">
          How keywords are used
        </h3>
        <p class="mt-1 text-sm text-text-muted">
          Suggestions are a starting point the customer can rewrite or ignore,
          and the stars are never pre-filled. Keep keywords descriptive
          (“biryani”, “same-day repair”) rather than asking for praise.
        </p>
        <div class="mt-1">
          <SectionLink href="/reviews/new" label="See how a request looks" />
        </div>
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------ connections */

export type GoogleState = "loading" | "connected" | "disconnected" | "unknown";

export function ConnectionsPanel(props: {
  google: GoogleState;
  placeId: string;
  readOnly: boolean;
  focusHeading: boolean;
  disconnecting: boolean;
  onDisconnect: () => void;
  returnTo: string;
}) {
  const authHref = () =>
    `/api/google/auth?returnTo=${encodeURIComponent(props.returnTo)}`;

  return (
    <div class="flex flex-col gap-6">
      <SettingsSection
        id="connections"
        title="Connections"
        lead="Connect Google Business Profile to read your rating and reviews inside Flonion."
        focusHeading={props.focusHeading}
      >
        <section
          aria-labelledby="set-google-title"
          class="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center"
        >
          <span
            aria-hidden="true"
            class="grid size-11 shrink-0 place-items-center rounded-md bg-surface"
          >
            <IconBrandGoogle class="size-5 text-text" />
          </span>
          <div class="min-w-0 flex-1">
            <h3
              id="set-google-title"
              class="font-display text-base font-semibold text-text"
            >
              Google Business Profile
            </h3>
            <p class="text-sm text-text-muted">
              <Switch fallback="Your rating, reviews and listing score come from this connection.">
                <Match when={props.google === "connected"}>
                  Rating, reviews and listing score are live.
                </Match>
                <Match when={props.google === "unknown"}>
                  We couldn't check this connection just now.
                </Match>
              </Switch>
            </p>
          </div>
          <Switch>
            <Match when={props.google === "loading"}>
              <span class="flex min-h-11 items-center gap-2 text-sm text-text-muted">
                <Spinner class="size-4" />
                Checking…
              </span>
            </Match>
            <Match when={props.google === "connected"}>
              <span class="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-success">
                <IconCircleCheck aria-hidden="true" class="size-4" />
                Connected
              </span>
            </Match>
            <Match when={true}>
              <a href={authHref()} class={cn(btnSecondary, "shrink-0")}>
                <IconPlugConnected aria-hidden="true" class="size-5" />
                Connect Google
              </a>
            </Match>
          </Switch>
        </section>

        <div class="mt-4">
          <ReadOnlyRow
            label="Matched location"
            hint={
              props.placeId
                ? undefined
                : "Set during onboarding or when you connect Google. Without it, the rating on your dashboard stays blank."
            }
          >
            <Show
              when={props.placeId}
              fallback={<span class="text-text-muted">Not matched yet</span>}
            >
              <span class="font-mono text-sm break-all text-text">
                {props.placeId}
              </span>
            </Show>
          </ReadOnlyRow>
          <ReadOnlyRow label="Google profile">
            <a
              href="https://business.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline underline-offset-4"
            >
              Open on Google
              <IconExternalLink aria-hidden="true" class="size-4" />
              <span class="sr-only"> (opens in a new tab)</span>
            </a>
          </ReadOnlyRow>
        </div>
      </SettingsSection>

      <Show when={!props.readOnly}>
        <section
          aria-labelledby="set-danger-title"
          class="rounded-lg border border-error/40 bg-surface p-5 md:p-6"
        >
          <div class="flex items-start gap-3">
            <span
              aria-hidden="true"
              class="grid size-9 shrink-0 place-items-center rounded-full bg-error/10 text-error"
            >
              <IconAlertTriangle class="size-5" />
            </span>
            <div class="min-w-0">
              <h2
                id="set-danger-title"
                class="font-display text-lg font-semibold text-text"
              >
                Danger zone
              </h2>
              <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
                Disconnecting removes Flonion's access to your Google reviews.
                Your review links and QR codes keep working — the rating and
                inbox go blank until you reconnect.
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p class="min-w-0 flex-1 text-sm text-text-muted">
              Disconnect Google Business Profile
            </p>
            <button
              type="button"
              disabled={
                props.disconnecting ||
                props.google === "loading" ||
                props.google === "disconnected"
              }
              onClick={props.onDisconnect}
              class={cn(
                btnSecondary,
                "min-h-10 border-error/50 px-4 text-sm text-error hover:bg-error/5",
                "disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted disabled:hover:bg-transparent",
              )}
            >
              <Show when={props.disconnecting}>
                <Spinner class="size-4" />
              </Show>
              Disconnect
            </button>
          </div>
        </section>
      </Show>
    </div>
  );
}

/** Shown to invited members: every setting is readable, none is editable. */
export function ReadOnlyBanner(props: { ctaHref?: string }) {
  return (
    <Notice tone="info">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>
          Only the business owner can change these settings. You can see what is
          set, and nothing you type here is saved.
        </span>
        <Show when={props.ctaHref}>
          {(href) => (
            <a href={href()} class={cn(btnPrimary, "min-h-9 px-3 text-sm")}>
              <IconQrcode aria-hidden="true" class="size-4" />
              Create a request
            </a>
          )}
        </Show>
      </div>
    </Notice>
  );
}
