import { Suspense } from "solid-js";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { MobileNavigation } from "~/components/layout/mobile-navigation";
import LogoComponent from "~/assets/logo";

export default function AppLayout(props: { children: any }) {
  return (
    <div class="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar />

      <div class="flex min-w-0 min-h-0 flex-1 flex-col">
        <header class="flex items-center gap-3 border-b border-border bg-background px-4 py-4 sm:px-6 lg:hidden">
          <MobileNavigation />
          <LogoComponent class="h-8 w-auto" />
        </header>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8">
          <Suspense>
            {props.children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

