import { Suspense } from "solid-js";

export default function OnboardingLayout(props: { children: any }) {
  return (
    <div class="min-h-dvh bg-background text-foreground">
      <main class="flex-1">
        <Suspense>
          {props.children}
        </Suspense>
      </main>
    </div>
  );
}
