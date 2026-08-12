import { createSignal, onMount, Show, type Component } from "solid-js";
import { Lock } from "lucide-solid";
import { useNavigate, useSearchParams } from "@solidjs/router";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { useSettings } from "~/stores/settings-store";
import {
  ProgressStepper,
  BasicsStep,
  PlatformsStep,
  ReviewStep,
  type BasicsData,
} from "~/components/onboarding";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialStep = (): number => {
    const step = Number(searchParams.step);
    if (step >= 1 && step <= 3) return step;
    return 1;
  };

  const [currentStep, setCurrentStep] = createSignal<number>(getInitialStep());
  const [saving, setSaving] = createSignal(false);

  const [basicsData, setBasicsData] = createSignal<BasicsData>({
    businessName: "",
    address: "",
    city: "",
    pinCode: "",
    category: "Restaurant",
    sector: "",
    keywords: "",
    logo: null,
  });

  const updateStep = (step: number) => {
    setCurrentStep(step);
    setSearchParams({ step: String(step) });
  };

  onMount(() => {
    fetch("/api/business")
      .then((res) => res.json())
      .then((data) => {
        if (data.businessName) {
          setBasicsData({
            businessName: data.businessName ?? "",
            address: data.address ?? "",
            city: "",
            pinCode: "",
            category: "Restaurant",
            sector: data.sector ?? "",
            keywords: data.keywords ?? "",
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

  const { refetch, updateSettings } = useSettings();

  const handleComplete = async () => {
    if (!basicsData().businessName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: basicsData().businessName,
          address: [basicsData().address, basicsData().city, basicsData().pinCode]
            .filter(Boolean)
            .join(", "),
          sector: basicsData().sector,
          keywords: basicsData().keywords,
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
          });
        } else {
          await refetch();
        }
        navigate("/dashboard");
      }
    } catch {
      // Save failed — stay on page
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Tell us about your business", "Connect your platforms", "Review your profile"] as const;

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
          <div class="text-center">
            <h1 id="onboarding-title" class="font-heading">
              {stepTitles[currentStep() - 1]}
            </h1>
            <p class="mt-2 text-base text-muted-foreground">
              <Show
                when={currentStep() === 1}
                fallback="Almost there! This takes less than a minute."
              >
                Let's personalize Flonion for your business. This takes less than a minute.
              </Show>
            </p>
          </div>

          <ProgressStepper currentStep={currentStep()} />

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

          <p class="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Lock size={14} strokeWidth={2} aria-hidden="true" />
            Your business information is private and secure.
          </p>
        </section>
      </main>
    </div>
  );
}
