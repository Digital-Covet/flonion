import { MetaProvider, Title } from "@solidjs/meta";
import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show } from "solid-js";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { MobileNavigation } from "~/components/layout/mobile-navigation";
import LogoComponent from "~/assets/logo";
import { SettingsProvider } from "~/stores/SettingsProvider";
import "./app.css";

export default function App() {
  return (
    <SettingsProvider>
      <Router
        root={(props) => (
          <MetaProvider>
            <Title>SEO Optimizer — Cognitive Enterprise</Title>
            <RootLayout>{props.children}</RootLayout>
          </MetaProvider>
        )}
      >
        <FileRoutes />
      </Router>
    </SettingsProvider>
  );
}

function RootLayout(props: { children: any }) {
  const location = useLocation();
  const isSharedReview = () => location.pathname.startsWith("/review/");

  return (
    <Show
      when={!isSharedReview()}
      fallback={
        <div class="flex min-h-dvh flex-col bg-background text-foreground">
          <main class="flex-1">
            <Suspense>{props.children}</Suspense>
          </main>
        </div>
      }
    >
      <div class="flex min-h-dvh bg-background text-foreground">
        <AppSidebar />

        <div class="flex min-w-0 flex-1 flex-col lg:h-dvh">
          <header class="flex items-center gap-3 border-b border-border bg-background px-4 py-4 sm:px-6 lg:hidden">
            <MobileNavigation />
            <LogoComponent class="h-8 w-auto" />
          </header>

          <main class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <Suspense>{props.children}</Suspense>
          </main>
        </div>
      </div>
    </Show>
  );
}
