import { createSignal, onMount, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import { toSlug } from "~/lib/slug";

export default function ReviewRedirect() {
  const [errorTitle, setErrorTitle] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  onMount(async () => {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      setErrorTitle("No review ID provided.");
      return;
    }

    try {
      const response = await fetch(`/api/reviews/share?id=${id}`);

      if (!response.ok) {
        setErrorTitle("Review link not found.");
        setErrorMessage("It may have expired or been removed.");
        return;
      }

      const data = await response.json();
      const businessName = data.business?.name;

      if (!businessName) {
        setErrorTitle("Could not determine business for this review.");
        return;
      }

      const slug = toSlug(businessName);
      window.location.replace(`/company/${slug}/review/${id}`);
    } catch {
      setErrorTitle("Could not connect to the server.");
    }
  });

  return (
    <>
      <Title>Redirecting...</Title>

      <div class="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
        <Show
          when={!errorTitle()}
          fallback={
            <div class="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-md backdrop-blur-sm sm:p-10">
              <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive-muted">
                <AlertTriangle class="size-7 text-destructive" />
              </div>
              <p class="font-heading text-xl font-semibold text-foreground">
                {errorTitle()}
              </p>
              <Show when={errorMessage()}>
                <p class="mt-2 text-sm text-muted-foreground">
                  {errorMessage()}
                </p>
              </Show>
            </div>
          }
        >
          <div class="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 p-8 text-center shadow-md backdrop-blur-sm sm:p-10">
            <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <div class="size-5 animate-pulse rounded-full bg-muted-foreground/20" />
            </div>
            <p class="text-sm text-muted-foreground">Redirecting...</p>
          </div>
        </Show>
      </div>
    </>
  );
}
