import { Suspense } from "solid-js";
import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { SettingsProvider } from "~/stores/SettingsProvider";
import "./app.css";

export default function App() {
  return (
    <SettingsProvider>
      <Router
        root={(props) => (
          <MetaProvider>
            <Title>Flonion - Grow Your Business with Better Reviews</Title>
            <Suspense>{props.children}</Suspense>
          </MetaProvider>
        )}
      >
        <FileRoutes />
      </Router>
    </SettingsProvider>
  );
}
