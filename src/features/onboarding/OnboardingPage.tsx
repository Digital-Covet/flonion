import { createSignal, onMount, Show, type Component } from "solid-js";
import { Lock } from "lucide-solid";
import { useNavigate, useSearchParams } from "@solidjs/router";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { useSettings } from "~/stores/settings-store";
import { authClient } from "~/lib/auth-client";
import {
  ProgressStepper,
  BasicsStep,
  PlatformsStep,
  ReviewStep,
  InviteTeamStep,
  type BasicsData,
  type TeamInvite,
} from "~/components/onboarding";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = authClient.useSession();

  const [pendingInvite, setPendingInvite] = createSignal<{
    token: string;
    businessName: string;
    role: string;
    inviterName: string;
  } | null>(null);
  const [inviteLoading, setInviteLoading] = createSignal(false);
  const [inviteError, setInviteError] = createSignal("");
  const [confirmingDecline, setConfirmingDecline] = createSignal(false);

  const getInitialStep = (): number => {
    const step = Number(searchParams.step);
    if (step >= 1 && step <= 4) return step;
    return 1;
  };

  const [currentStep, setCurrentStep] = createSignal<number>(getInitialStep());
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");

  const [basicsData, setBasicsData] = createSignal<BasicsData>({
    businessName: "",
    username: "",
    address: "",
    city: "",
    pinCode: "",
    category: "Restaurant",
    sector: "",
    customSector: "",
    keywords: "",
    description: "",
    logo: null,
  });

  const [teamInvites, setTeamInvites] = createSignal<TeamInvite[]>([]);

  const updateStep = (step: number) => {
    setCurrentStep(step);
    setSearchParams({ step: String(step) });
  };

  onMount(async () => {
    // Check for pending invitations first
    try {
      const inviteRes = await fetch("/api/team/check-invite");
      if (inviteRes.ok) {
        const inviteData = await inviteRes.json();
        if (inviteData.invitation) {
          setPendingInvite({
            token: inviteData.invitation.token,
            businessName: inviteData.invitation.business.name,
            role: inviteData.invitation.role,
            inviterName: inviteData.invitation.invitedBy.name || inviteData.invitation.invitedBy.email,
          });
          return; // Don't fetch business data if there's a pending invite
        }
      }
    } catch {
      // Continue to onboarding
    }

    fetch("/api/business")
      .then((res) => res.json())
      .then((data) => {
        if (data.businessName) {
          setBasicsData({
            businessName: data.businessName ?? "",
            username: data.username ?? "",
            address: data.address ?? "",
            city: "",
            pinCode: "",
            category: "Restaurant",
            sector: data.sector ?? "",
            customSector: "",
            keywords: data.keywords ?? "",
            description: data.description ?? "",
            logo: data.logo ?? null,
          });
        }
      })
      .catch(() => {
        // Not yet onboarded — start fresh
      });
  });

  const handleBasicsChange = (partial: Partial<BasicsData>) => {
    setBasicsData((prev) => ({ ...prev, ...partial }));
  };

  const handleBasicsContinue = () => {
    updateStep(2);
  };

  const handlePlatformsBack = () => {
    updateStep(1);
  };

  const handlePlatformsContinue = () => {
    updateStep(3);
  };

  const handleReviewBack = () => {
    updateStep(2);
  };

  const handleReviewContinue = () => {
    updateStep(4);
  };

  const handleAddInvite = (invite: TeamInvite) => {
    setTeamInvites((prev) => [...prev, invite]);
  };

  const handleRemoveInvite = (email: string) => {
    setTeamInvites((prev) => prev.filter((i) => i.email !== email));
  };

  const handleInviteContinue = () => {
    sendInvitesAndComplete();
  };

  const handleInviteSkip = () => {
    sendInvitesAndComplete();
  };

  const handleAcceptInvitation = async () => {
    const invite = pendingInvite();
    if (!invite) return;

    setInviteLoading(true);
    setInviteError("");

    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token }),
      });

      if (res.ok) {
        navigate("/dashboard");
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to accept invitation");
      }
    } catch {
      setInviteError("Failed to accept invitation. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeclineInvitation = async () => {
    const invite = pendingInvite();
    if (!invite) return;

    setInviteLoading(true);
    setInviteError("");

    // Recorded server-side, not just hidden: creating your own business makes
    // this invitation permanently unacceptable by this account, so the inviter
    // needs to see it resolved rather than waiting on a pending invite.
    try {
      const res = await fetch("/api/team/decline-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setInviteError(data?.error ?? "Couldn't decline the invitation. Please try again.");
        return;
      }
    } catch {
      setInviteError("Couldn't decline the invitation. Please try again.");
      return;
    } finally {
      setInviteLoading(false);
    }

    setConfirmingDecline(false);
    setPendingInvite(null);
    // Continue with normal onboarding
    fetch("/api/business")
      .then((res) => res.json())
      .then((data) => {
        if (data.businessName) {
          setBasicsData({
            businessName: data.businessName ?? "",
            username: data.username ?? "",
            address: data.address ?? "",
            city: "",
            pinCode: "",
            category: "Restaurant",
            sector: data.sector ?? "",
            customSector: "",
            keywords: data.keywords ?? "",
            description: data.description ?? "",
            logo: data.logo ?? null,
          });
        }
      })
      .catch(() => {});
  };

  const { refetch, updateSettings } = useSettings();

  const sendInvitesAndComplete = async () => {
    const invites = teamInvites();
    const failed: string[] = [];

    for (const invite of invites) {
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: invite.email, role: invite.role }),
        });
        if (!res.ok) failed.push(invite.email);
      } catch {
        failed.push(invite.email);
      }
    }

    // A dropped invite is silent otherwise — the invitee simply never hears back.
    if (failed.length > 0) {
      setSaveError(
        `Couldn't send an invite to ${failed.join(", ")}. You can retry from Settings > Team.`,
      );
      return;
    }

    navigate("/dashboard");
  };

  const handleComplete = async () => {
    if (!basicsData().businessName.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: basicsData().businessName,
          username: basicsData().username,
          address: [basicsData().address, basicsData().city, basicsData().pinCode]
            .filter(Boolean)
            .join(", "),
          sector:
            basicsData().sector === "Other" && basicsData().customSector.trim()
              ? basicsData().customSector
              : basicsData().sector,
          keywords: basicsData().keywords,
          description: basicsData().description,
          logo: basicsData().logo,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          updateSettings({
            placeId: data.placeId ?? "",
            logo: data.logo ?? null,
            businessName: data.businessName ?? "",
            phone: data.phone ?? "",
            address: data.address ?? "",
            keywords: data.keywords ?? "",
            description: data.description ?? "",
          });
        } else {
          await refetch();
        }
        updateStep(4);
      } else {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? "Couldn't save your business. Please try again.");
      }
    } catch {
      setSaveError("Couldn't save your business. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Tell us about your business", "Connect your platforms", "Review your profile", "Invite your team"] as const;

  return (
    <div class="min-h-screen bg-background text-foreground">
      <header class="glass-card fixed inset-x-0 top-0 z-50 flex h-16 items-center px-4 shadow-sm md:px-10">
        <a
          href="/"
          aria-label="Flonion home"
        >
          <InlineCombinationMark class="h-6 w-auto" />
        </a>
      </header>

      <main class="hero-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-12 pt-24 md:px-10">
        <div
          class="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/30 blur-3xl motion-safe:animate-pulse"
          aria-hidden="true"
        />

        <section
          class="relative z-10 flex w-full max-w-xl animate-fade-in-up flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-md sm:p-6"
          aria-labelledby="onboarding-title"
        >
          <Show when={!pendingInvite()}>
            <div class="text-center">
              <h1 id="onboarding-title" class="font-heading">
                {stepTitles[currentStep() - 1]}
              </h1>
              <p class="mt-2 text-base text-muted-foreground">
                <Show
                  when={currentStep() === 1}
                  fallback={
                    currentStep() === 4
                      ? "Add team members to collaborate with you."
                      : "Almost there! This takes less than a minute."
                  }
                >
                  Let's personalize Flonion for your business. This takes less than a minute.
                </Show>
              </p>
            </div>

            <ProgressStepper currentStep={currentStep()} />

            <Show when={saveError()}>
              <p role="alert" class="text-sm text-destructive">{saveError()}</p>
            </Show>

            <Show when={currentStep() === 1}>
              <BasicsStep
                data={basicsData()}
                onChange={handleBasicsChange}
                onContinue={handleBasicsContinue}
              />
            </Show>

            <Show when={currentStep() === 2}>
              <PlatformsStep
                onContinue={handlePlatformsContinue}
                onBack={handlePlatformsBack}
              />
            </Show>

            <Show when={currentStep() === 3}>
              <ReviewStep
                data={basicsData()}
                onComplete={handleComplete}
                onBack={handleReviewBack}
                saving={saving()}
              />
            </Show>

            <Show when={currentStep() === 4}>
              <InviteTeamStep
                invites={teamInvites()}
                onAddInvite={handleAddInvite}
                onRemoveInvite={handleRemoveInvite}
                onContinue={handleInviteContinue}
                onSkip={handleInviteSkip}
              />
            </Show>
          </Show>

          <Show when={pendingInvite()}>
            <div class="flex flex-col items-center gap-4 text-center">
              <h1 id="onboarding-title" class="font-heading">
                You've been invited!
              </h1>
              <p class="text-base text-muted-foreground">
                <span class="font-medium text-foreground">{pendingInvite()!.inviterName}</span>{" "}
                has invited you to join{" "}
                <span class="font-medium text-foreground">{pendingInvite()!.businessName}</span>{" "}
                as a <span class="font-medium text-foreground">{pendingInvite()!.role}</span>.
              </p>

              <Show when={inviteError()}>
                <p class="text-sm text-destructive">{inviteError()}</p>
              </Show>

              <Show
                when={confirmingDecline()}
                fallback={
                  <div class="flex gap-3 mt-2">
                    <button
                      onClick={handleAcceptInvitation}
                      disabled={inviteLoading()}
                      class="px-6 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      {inviteLoading() ? "Accepting..." : "Accept Invitation"}
                    </button>
                    <button
                      onClick={() => setConfirmingDecline(true)}
                      disabled={inviteLoading()}
                      class="px-6 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      Create My Own Business
                    </button>
                  </div>
                }
              >
                <div class="mt-2 flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-4">
                  <p class="text-sm text-muted-foreground">
                    If you create your own business, this account will{" "}
                    <span class="font-medium text-foreground">no longer be able to join</span>{" "}
                    {pendingInvite()!.businessName}. You'd need a fresh invitation to a different
                    account.
                  </p>
                  <div class="flex gap-3">
                    <button
                      onClick={handleDeclineInvitation}
                      disabled={inviteLoading()}
                      class="px-6 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      {inviteLoading() ? "Declining..." : "Yes, create my own"}
                    </button>
                    <button
                      onClick={() => setConfirmingDecline(false)}
                      disabled={inviteLoading()}
                      class="px-6 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <p class="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Lock size={14} strokeWidth={2} aria-hidden="true" />
            Your business information is private and secure.
          </p>
        </section>
      </main>
    </div>
  );
}
