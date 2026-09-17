import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { ButtonLink } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";

// Something broke on our side. Plain language + Home + Search + Back, plus
// the reference ID so support can correlate server logs (spec §6).
export default function ServerErrorPage() {
  const [searchParams] = useSearchParams();
  const ref = () => {
    const v = searchParams.ref;
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  return (
    <>
      <Title>Something went wrong — Flonion</Title>
      <main class="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
        <div class="e1-enter w-full max-w-xl rounded-card border border-border bg-card p-8 text-center shadow-md sm:p-10">
          <p class="tnum text-sm font-medium uppercase tracking-wide text-muted-foreground">
            500
          </p>
          <h1 class="mt-1 font-heading text-2xl font-semibold text-foreground">
            Something went wrong on our end
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            It's not your fault. Try again in a moment — and if it keeps
            happening, send us the reference below.
          </p>
          {ref() && (
            <div class="mx-auto mt-4 max-w-sm rounded-card border border-border bg-muted/50 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reference ID
              </p>
              <p class="tnum mt-1 font-mono text-sm text-foreground">{ref()}</p>
              <CopyButton
                value={() => ref()}
                label="Copy reference"
                copiedLabel="Copied"
                size="sm"
                class="mt-2"
              />
            </div>
          )}
          <div class="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/">Home</ButtonLink>
            <ButtonLink href="/marketplace" variant="outline">
              Browse marketplace
            </ButtonLink>
            <button
              type="button"
              onClick={() => window.location.reload()}
              class="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-medium text-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
