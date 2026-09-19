import { Title } from "@solidjs/meta";
import { Show } from "solid-js";
import { WidgetError } from "~/components/dashboard/ui";
import { FeedbackForm } from "~/components/feedback/FeedbackForm";
import { SectionSkeleton, sectionCard } from "~/components/settings/ui";
import { authClient } from "~/lib/auth-client";

/**
 * Product feedback (spec §6, Feedback: "Short form; success replaces the
 * form"). Reached from the account menu rather than the sidebar — it's a
 * personal action, like `/account`, not part of the daily loop — so it keeps
 * the app shell but sits in a single narrow column instead of the 12-column
 * grid the data pages use.
 */
export default function FeedbackPage() {
  const session = authClient.useSession();

  const user = () => session().data?.user;
  const loading = () => session().isPending && !user();
  const failed = () => Boolean(session().error) && !user();

  return (
    <>
      <Title>Send feedback · Flonion</Title>

      <div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <header class="min-w-0">
          <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
            Send feedback
          </h1>
          <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
            Tell us what's working and what isn't. This goes straight to the
            people building Flonion.
          </p>
        </header>

        <Show when={failed()}>
          <WidgetError
            what="your account"
            onRetry={() => void session().refetch()}
          />
        </Show>

        <Show
          when={user()}
          fallback={
            <Show when={loading()}>
              <SectionSkeleton fields={4} />
            </Show>
          }
        >
          {(signedIn) => (
            <section aria-label="Feedback form" class={sectionCard}>
              <FeedbackForm
                defaultName={signedIn().name ?? ""}
                defaultEmail={signedIn().email ?? ""}
              />
            </section>
          )}
        </Show>
      </div>
    </>
  );
}
