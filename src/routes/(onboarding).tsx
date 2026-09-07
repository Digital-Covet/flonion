import type { RouteSectionProps } from "@solidjs/router";
import { Suspense } from "solid-js";

export default function OnboardingLayout(props: RouteSectionProps) {
  return (
    <div class="min-h-dvh bg-background text-foreground">
      <main class="flex-1">
        <Suspense>{props.children}</Suspense>
      </main>
    </div>
  );
}
