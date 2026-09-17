import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import Search from "lucide-solid/icons/search";
import { createSignal } from "solid-js";
import { ButtonLink } from "~/components/ui/button";

// Catch-all: unknown paths, expired/invalid redirect IDs (via /404), and any
// other dead end land here. Plain language + Home + Search + Back (spec §6).
export default function NotFoundPage() {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");

  const search = (e: Event) => {
    e.preventDefault();
    const q = query().trim();
    navigate(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  return (
    <>
      <Title>Page not found — Flonion</Title>
      <main class="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
        <div class="e1-enter w-full max-w-xl rounded-card border border-border bg-card p-8 text-center shadow-md sm:p-10">
          <p class="tnum text-sm font-medium uppercase tracking-wide text-muted-foreground">
            404
          </p>
          <h1 class="mt-1 font-heading text-2xl font-semibold text-foreground">
            This page doesn't exist
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            The link may be mistyped, expired, or the page may have moved.
          </p>

          <search class="mx-auto mt-6 max-w-sm">
            <form onSubmit={search}>
              <label for="not-found-search" class="sr-only">
                Search businesses
              </label>
              <div class="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="not-found-search"
                  type="search"
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search businesses…"
                  class="h-11 w-full rounded-control border border-input bg-background pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </form>
          </search>

          <div class="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/">Home</ButtonLink>
            <ButtonLink href="/marketplace" variant="outline">
              Browse marketplace
            </ButtonLink>
            <button
              type="button"
              onClick={() => window.history.back()}
              class="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
            >
              Go back
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
