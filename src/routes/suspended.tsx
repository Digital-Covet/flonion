import { IconAlertTriangle } from "@tabler/icons-solidjs";
import { AuthShell, submitClass, textLink } from "~/components/auth/AuthShell";
import { PageMeta } from "~/components/meta/PageMeta";
import { authClient } from "~/lib/auth-client";

/**
 * Where the middleware sends a signed-in member of a suspended business. It is
 * a public path so the redirect cannot loop; it reads nothing about the
 * business, so it discloses nothing to a visitor who lands here directly.
 */
export default function SuspendedPage() {
  async function logOut() {
    await authClient.signOut().catch(() => {});
    window.location.assign("/login");
  }

  return (
    <>
      <PageMeta title="Account suspended · Flonion" path="/suspended" noindex />
      <AuthShell
        skipTo="suspended-notice"
        skipLabel="Skip to notice"
        aside={
          <a href="/" class={textLink}>
            Back to Flonion
          </a>
        }
      >
        <div id="suspended-notice" class="flex flex-col gap-4">
          <IconAlertTriangle aria-hidden="true" class="size-8 text-error" />
          <h1 class="text-2xl font-semibold text-text">
            This business is suspended
          </h1>
          <p class="text-base text-text-muted">
            Access to this workspace has been paused by the Flonion team. Its
            public profile, reviews and marketplace listing are hidden while the
            suspension is in place. If you think this is a mistake, contact the
            Flonion team.
          </p>
          <button
            type="button"
            class={submitClass}
            onClick={() => void logOut()}
          >
            Log out
          </button>
        </div>
      </AuthShell>
    </>
  );
}
