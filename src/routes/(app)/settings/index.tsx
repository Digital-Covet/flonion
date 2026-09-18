import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useApp } from "~/components/app/context";
import { profileHref } from "~/components/app/nav";
import { settled } from "~/components/dashboard/data";
import { WidgetError } from "~/components/dashboard/ui";
import {
  api,
  ConfirmDialog,
  NETWORK_ERROR,
  Notice,
} from "~/components/onboarding/ui";
import {
  type SettingsField,
  type SettingsForm,
  saveSettings,
  sectionForField,
  snapshot,
  toForm,
  validate,
} from "~/components/settings/form";
import {
  ConnectionsPanel,
  type GoogleState,
  type PanelProps,
  PlatformsPanel,
  ProfilePanel,
  ReadOnlyBanner,
  ReviewLinkPanel,
  ReviewSettingsPanel,
} from "~/components/settings/panels";
import {
  BackToSections,
  isSectionId,
  SaveBar,
  SECTIONS,
  type SectionId,
  SectionLink,
  SectionNav,
  SectionSkeleton,
} from "~/components/settings/ui";
import { cn } from "~/lib/cn";

/** Reasons `GET /api/google/callback` can bounce back here. */
const GOOGLE_ERRORS: Record<string, string> = {
  denied: "Google sign-in was cancelled. Nothing changed.",
  invalid_state:
    "That Google sign-in took too long. Start the connection again.",
  missing_code: "Google didn't send us a code. Try connecting again.",
  exchange_failed:
    "Google accepted the sign-in but wouldn't issue a token. Try again.",
  error: "Something went wrong connecting Google. Try again.",
};

const emptyForm = (): SettingsForm => ({
  businessName: "",
  sector: "",
  phone: "",
  address: "",
  description: "",
  username: "",
  links: {},
  keywords: [],
  placeId: "",
  logo: null,
});

export default function SettingsPage() {
  const { business, refetchBusiness } = useApp();
  const [params, setParams] = useSearchParams();

  const info = () => settled(business);
  /** `POST /api/business` upserts the caller's own business, so only the owner can save. */
  const readOnly = () => Boolean(info()) && !info()?.isOwner;

  /* ── section, kept in the URL so the OAuth round-trip returns here ── */
  const raw = () =>
    Array.isArray(params.section) ? params.section[0] : params.section;
  const section = (): SectionId | null => {
    const value = raw();
    return isSectionId(value) ? value : null;
  };
  /** Desktop always shows a panel; mobile shows the section list until one is picked. */
  const shown = (): SectionId => section() ?? "profile";
  const [navigated, setNavigated] = createSignal(false);

  function open(id: SectionId) {
    setNavigated(true);
    setParams({ section: id }, { replace: true, scroll: false });
  }
  function close() {
    setNavigated(false);
    setParams({ section: undefined }, { replace: true, scroll: false });
  }

  /* ── form draft, seeded once the business resolves ── */
  const [form, setForm] = createStore<SettingsForm>(emptyForm());
  const [baseline, setBaseline] = createSignal(snapshot(emptyForm()));
  const [errors, setErrors] = createSignal<
    Partial<Record<SettingsField, string>>
  >({});
  const [saving, setSaving] = createSignal(false);
  const [banner, setBanner] = createSignal<
    { tone: "success" | "error" | "warning"; text: string } | undefined
  >();
  const [announce, setAnnounce] = createSignal("");
  const [origin, setOrigin] = createSignal("");

  onMount(() => setOrigin(window.location.origin));

  /**
   * Seeded on arrival and after every save. `reconcile` keeps the store's
   * identity so a field the owner is typing in is not re-created under them
   * when the shared business resource refreshes.
   */
  function seed(next: SettingsForm) {
    setForm(reconcile(next));
    setBaseline(snapshot(next));
    setErrors({});
  }

  createEffect(
    on(
      () => info()?.businessId,
      (id, previous) => {
        if (!id || id === previous) return;
        const data = info();
        if (data) seed(toForm(data));
      },
    ),
  );

  const dirty = createMemo(() => !readOnly() && snapshot(form) !== baseline());

  /** A half-edited form is easy to lose to a stray tab close or back gesture. */
  onMount(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!dirty()) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    onCleanup(() => window.removeEventListener("beforeunload", warn));
  });

  /* ── Google connection ── */
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  const [google, { refetch: refetchGoogle, mutate: mutateGoogle }] =
    createResource<GoogleState, boolean>(ready, async () => {
      try {
        const { ok, data } = await api<{ connected: boolean }>(
          "/api/google/status",
        );
        if (!ok) return "unknown";
        return data.connected ? "connected" : "disconnected";
      } catch {
        return "unknown";
      }
    });
  const googleState = (): GoogleState => google() ?? "loading";

  const [confirmDisconnect, setConfirmDisconnect] = createSignal(false);
  const [disconnecting, setDisconnecting] = createSignal(false);

  async function disconnect() {
    if (disconnecting()) return;
    setDisconnecting(true);
    setBanner(undefined);
    try {
      const { ok, data } = await api<{ success: boolean }>(
        "/api/google/disconnect",
        { method: "POST" },
      );
      if (!ok) {
        setBanner({
          tone: "error",
          text: data.error ?? "We couldn't disconnect Google. Try again.",
        });
        return;
      }
      mutateGoogle("disconnected");
      setConfirmDisconnect(false);
      setBanner({
        tone: "success",
        text: "Google is disconnected. Your review links and QR codes still work.",
      });
      setAnnounce("Google disconnected");
      refetchBusiness();
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setDisconnecting(false);
    }
  }

  /* ── OAuth return, read once ── */
  onMount(() => {
    const connected = Array.isArray(params.connected)
      ? params.connected[0]
      : params.connected;
    const failure = Array.isArray(params.google)
      ? params.google[0]
      : params.google;

    if (connected === "true") {
      setBanner({
        tone: "success",
        text: "Google Business Profile connected.",
      });
      setAnnounce("Google connected");
      refetchBusiness();
    } else if (failure) {
      setBanner({
        tone: "warning",
        text: GOOGLE_ERRORS[failure] ?? GOOGLE_ERRORS.error!,
      });
    }

    if (connected || failure) {
      setParams(
        { connected: undefined, google: undefined, section: "connections" },
        { replace: true, scroll: false },
      );
    }
  });

  /* ── save ── */
  function clearError(field: SettingsField) {
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }
  function setError(field: SettingsField, message: string | undefined) {
    setErrors((e) => ({ ...e, [field]: message }));
  }

  /** Moves to the panel holding a rejected field and focuses its input. */
  function reveal(field: SettingsField) {
    const target = sectionForField(field);
    if (section() !== target) open(target);
    const id = field.startsWith("link:")
      ? `set-link-${field.slice(5)}`
      : field === "businessName"
        ? "set-name"
        : field === "phone"
          ? "set-phone"
          : "set-username";
    queueMicrotask(() =>
      document.getElementById(id)?.focus({ preventScroll: false }),
    );
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving() || readOnly() || !dirty()) return;

    const found = validate(form);
    setErrors(found);
    const first = Object.keys(found)[0] as SettingsField | undefined;
    if (first) {
      setBanner(undefined);
      setAnnounce("Some settings need fixing before saving");
      reveal(first);
      return;
    }

    setSaving(true);
    setBanner(undefined);
    try {
      const result = await saveSettings(form);
      switch (result.kind) {
        case "unauthorized":
          window.location.assign("/login?callbackURL=/settings");
          return;
        case "rejected":
          setBanner({ tone: "error", text: result.message });
          if (result.field) {
            setError(result.field, result.message);
            reveal(result.field);
          }
          setAnnounce(result.message);
          return;
        case "failed":
          setBanner({ tone: "error", text: result.message });
          setAnnounce(result.message);
          return;
        case "saved": {
          // Re-seed from what the server stored, not from the draft: it
          // lowercases the username and drops links it wouldn't keep.
          const data = info();
          if (data) seed(toForm({ ...data, ...result.business }));
          setBanner({ tone: "success", text: "Settings saved." });
          setAnnounce("Settings saved");
          refetchBusiness();
          return;
        }
      }
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
      setAnnounce("Saving failed");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    const data = info();
    if (data) seed(toForm(data));
    setBanner(undefined);
    setAnnounce("Changes discarded");
  }

  /**
   * Getters, not values: a spread of a plain object would freeze `errors` and
   * `readOnly` at render time, and a field error raised by a save would never
   * reach the input. `mergeProps` (what a JSX spread compiles to) forwards
   * getters, so each panel re-reads them.
   */
  const shared = {
    get form() {
      return form;
    },
    get errors() {
      return errors();
    },
    get readOnly() {
      return readOnly();
    },
    setForm,
    clearError,
    setError,
  } satisfies Omit<PanelProps, "focusHeading">;

  const focusHeading = (id: SectionId) => navigated() && shown() === id;

  const loading = () => !info() && business.state !== "errored";

  return (
    <>
      <Title>Settings · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {announce()}
      </p>

      <form novalidate onSubmit={save} class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Settings
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              Your business details, the link customers scan, and where their
              reviews go.
            </p>
          </div>
          <SectionLink href="/settings/team" label="Team settings" />
        </header>

        <Show when={business.state === "errored"}>
          <WidgetError what="your settings" onRetry={() => refetchBusiness()} />
        </Show>

        <Show when={readOnly()}>
          <ReadOnlyBanner ctaHref="/reviews/new" />
        </Show>

        <Show when={banner()}>
          {(note) => <Notice tone={note().tone}>{note().text}</Notice>}
        </Show>

        <div class="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-start">
          {/* Desktop: persistent left nav. Mobile: the list half of list-then-detail. */}
          <div
            class={cn(
              "md:sticky md:top-8",
              section() ? "hidden md:block" : "block",
            )}
          >
            <div class="hidden md:block">
              <SectionNav
                items={SECTIONS}
                label="Settings sections"
                current={shown()}
                onSelect={open}
              />
            </div>
            <div class="rounded-lg border border-border bg-surface p-2 md:hidden">
              <SectionNav
                items={SECTIONS}
                label="Settings sections"
                current={null}
                onSelect={open}
                detailed
              />
            </div>
          </div>

          <div class={cn("min-w-0", section() ? "block" : "hidden md:block")}>
            <Show when={section()}>
              <div class="mb-2">
                <BackToSections onClick={close} />
              </div>
            </Show>

            <Show when={!loading()} fallback={<SectionSkeleton />}>
              <Switch>
                <Match when={shown() === "profile"}>
                  <ProfilePanel
                    {...shared}
                    focusHeading={focusHeading("profile")}
                  />
                </Match>
                <Match when={shown() === "link"}>
                  <ReviewLinkPanel
                    {...shared}
                    focusHeading={focusHeading("link")}
                    origin={origin()}
                    profileHref={profileHref(info())}
                    savedUsername={info()?.username ?? ""}
                  />
                </Match>
                <Match when={shown() === "platforms"}>
                  <PlatformsPanel
                    {...shared}
                    focusHeading={focusHeading("platforms")}
                  />
                </Match>
                <Match when={shown() === "keywords"}>
                  <ReviewSettingsPanel
                    {...shared}
                    focusHeading={focusHeading("keywords")}
                  />
                </Match>
                <Match when={shown() === "connections"}>
                  <ConnectionsPanel
                    google={googleState()}
                    placeId={form.placeId}
                    readOnly={readOnly()}
                    focusHeading={focusHeading("connections")}
                    disconnecting={disconnecting()}
                    onDisconnect={() => setConfirmDisconnect(true)}
                    returnTo="/settings?section=connections"
                  />
                </Match>
              </Switch>
            </Show>

            <Show
              when={googleState() === "unknown" && shown() === "connections"}
            >
              <div class="mt-4">
                <WidgetError
                  what="your Google connection"
                  onRetry={() => refetchGoogle()}
                />
              </div>
            </Show>
          </div>
        </div>

        <SaveBar dirty={dirty()} saving={saving()} onDiscard={discard} />
      </form>

      <ConfirmDialog
        open={confirmDisconnect()}
        title="Disconnect Google?"
        description="Flonion will stop reading your Google rating and reviews. Your review links and QR codes keep working, and you can reconnect at any time."
        confirmLabel="Disconnect"
        pending={disconnecting()}
        onConfirm={disconnect}
        onClose={() => setConfirmDisconnect(false)}
      />
    </>
  );
}
