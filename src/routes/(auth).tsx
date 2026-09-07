import type { RouteSectionProps } from "@solidjs/router";
import { Suspense } from "solid-js";

export default function AuthLayout(props: RouteSectionProps) {
  return (
    <div class="flex min-h-dvh flex-col bg-background text-foreground">
      <main class="flex-1">
        <Suspense>{props.children}</Suspense>
      </main>
    </div>
  );
}
