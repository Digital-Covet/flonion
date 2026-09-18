import { useSearchParams } from "@solidjs/router";
import { createSignal, Match, onMount, Show, Switch } from "solid-js";
import { PageMeta } from "~/components/meta/PageMeta";
import {
  BusinessWizard,
  loadDraft,
} from "~/components/onboarding/BusinessWizard";
import {
  BranchChooser,
  type Invitation,
  InviteCard,
  type JoinRequest,
  JoinStatus,
  JoinTeam,
  type OwnedBusiness,
} from "~/components/onboarding/TeamFlows";
import {
  api,
  cardClass,
  Notice,
  OnboardingShell,
} from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";

type View =
  | { kind: "loading" }
  | { kind: "choose" }
  | { kind: "wizard" }
  | { kind: "join" }
  | { kind: "join-status"; request: JoinRequest };

const HEADERS: Record<View["kind"], { title: string; lead?: string }> = {
  loading: { title: "Let's get you set up" },
  choose: {
    title: "Let's get you set up",
    lead: "Start collecting genuine reviews in a few minutes, or join a team that already uses Flonion.",
  },
  wizard: {
    title: "Set up your business",
    lead: "Four short steps. Your progress is saved as you go.",
  },
  join: {
    title: "Join your team",
    lead: "Your team approves the request before you get access.",
  },
  "join-status": {
    title: "Join your team",
    lead: "Your team approves the request before you get access.",
  },
};

export default function OnboardingPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = createSignal<View>({ kind: "loading" });
  const [invite, setInvite] = createSignal<{
    invitation: Invitation;
    ownedBusiness: OwnedBusiness | null;
  } | null>(null);
  const [loadError, setLoadError] = createSignal(false);
  const [hasDraft, setHasDraft] = createSignal(false);
  const [wizardByClick, setWizardByClick] = createSignal(false);
  const openWizard = () => {
    setWizardByClick(true);
    setView({ kind: "wizard" });
  };

  // Read once: the OAuth callback's query params are stripped right after so a
  // refresh doesn't re-announce the result.
  const googleResult = (() => {
    if (params.connected === "true") return "connected" as const;
    if (params.google) return "failed" as const;
    return null;
  })();

  onMount(async () => {
    if (googleResult)
      setParams({ connected: undefined, google: undefined }, { replace: true });
    setHasDraft(Boolean(loadDraft()));

    const [inviteRes, joinRes] = await Promise.allSettled([
      api<{
        invitation: Invitation | null;
        ownedBusiness: OwnedBusiness | null;
      }>("/api/team/check-invite"),
      api<{ request: JoinRequest | null; joined: boolean }>(
        "/api/team/join-request",
      ),
    ]);

    if (inviteRes.status === "fulfilled" && inviteRes.value.status === 401) {
      window.location.assign("/login?callbackURL=/onboarding");
      return;
    }
    if (inviteRes.status === "rejected" && joinRes.status === "rejected") {
      setLoadError(true);
    }

    if (inviteRes.status === "fulfilled" && inviteRes.value.data.invitation) {
      setInvite({
        invitation: inviteRes.value.data.invitation,
        ownedBusiness: inviteRes.value.data.ownedBusiness ?? null,
      });
    }

    if (joinRes.status === "fulfilled" && joinRes.value.ok) {
      const { joined, request } = joinRes.value.data;
      if (joined) {
        window.location.assign("/dashboard");
        return;
      }
      if (
        !googleResult &&
        request &&
        (request.status === "pending" || request.status === "rejected")
      ) {
        setView({ kind: "join-status", request });
        return;
      }
    }

    // Coming back from Google, or resuming a started wizard, skips the chooser.
    setView(
      googleResult || (hasDraft() && !invite())
        ? { kind: "wizard" }
        : { kind: "choose" },
    );
  });

  const header = () => HEADERS[view().kind];

  return (
    <>
      <PageMeta title="Set up Flonion" path="/onboarding" noindex />

      <OnboardingShell
        eyebrow="Welcome to Flonion"
        title={header().title}
        lead={header().lead}
      >
        <Switch>
          <Match when={view().kind === "loading"}>
            <div
              aria-busy="true"
              aria-live="polite"
              class="flex flex-col gap-4"
            >
              <span class="sr-only">Loading your setup…</span>
              <div class={cn(cardClass, "flex flex-col gap-4")}>
                <div class="h-5 w-2/5 rounded-sm bg-primary-soft motion-safe:animate-pulse" />
                <div class="h-4 w-4/5 rounded-sm bg-primary-soft/70 motion-safe:animate-pulse" />
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="h-44 rounded-lg border border-border bg-surface motion-safe:animate-pulse" />
                <div class="h-44 rounded-lg border border-border bg-surface motion-safe:animate-pulse" />
              </div>
            </div>
          </Match>

          <Match when={view().kind === "choose"}>
            <div class="flex flex-col gap-6">
              <Show when={loadError()}>
                <Notice tone="warning">
                  We couldn't check for invitations. If you were invited, open
                  the link from your email again.
                </Notice>
              </Show>
              <Show when={invite()}>
                {(inv) => (
                  <>
                    <InviteCard
                      invitation={inv().invitation}
                      ownedBusiness={inv().ownedBusiness}
                      onDeclined={() => setInvite(null)}
                    />
                    <p class="text-center text-sm text-text-muted">
                      Or start another way
                    </p>
                  </>
                )}
              </Show>
              <BranchChooser
                hasDraft={hasDraft()}
                onSetup={openWizard}
                onJoin={() => setView({ kind: "join" })}
              />
            </div>
          </Match>

          <Match when={view().kind === "wizard"}>
            <BusinessWizard
              googleResult={googleResult}
              autoFocus={wizardByClick()}
              onExit={() => {
                setHasDraft(Boolean(loadDraft()));
                setView({ kind: "choose" });
              }}
            />
          </Match>

          <Match when={view().kind === "join"}>
            <JoinTeam
              onBack={() => setView({ kind: "choose" })}
              onRequested={(request) =>
                setView({ kind: "join-status", request })
              }
              onAlreadyMember={() => window.location.assign("/dashboard")}
            />
          </Match>

          <Match
            when={(() => {
              const v = view();
              return v.kind === "join-status" ? v.request : undefined;
            })()}
          >
            {(request) => (
              <JoinStatus
                request={request()}
                onChange={(next) =>
                  setView(
                    next &&
                      (next.status === "pending" || next.status === "rejected")
                      ? { kind: "join-status", request: next }
                      : { kind: "choose" },
                  )
                }
                onCreateOwn={openWizard}
                onAskAnother={() => setView({ kind: "join" })}
              />
            )}
          </Match>
        </Switch>
      </OnboardingShell>
    </>
  );
}
