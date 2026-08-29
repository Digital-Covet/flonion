import { createEffect, createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { authClient } from "~/lib/auth-client";
import { withInvite } from "~/lib/invite-redirect";

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();

  const [status, setStatus] = createSignal<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = createSignal("");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    const raw = searchParams.token ?? new URLSearchParams(window.location.search).get("token");
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const handleAcceptInvite = async (token: string) => {
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to accept invitation");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Failed to accept invitation. Please try again.");
      setStatus("error");
    }
  };

  const [started, setStarted] = createSignal(false);

  // Driven off the session store rather than a fixed timeout: a slow hydration
  // used to fire the accept POST before the cookie was readable, which came back
  // as a spurious 401.
  createEffect(() => {
    if (typeof window === "undefined" || started()) return;

    const token = getToken();
    if (!token) {
      setStarted(true);
      setErrorMessage("No invitation token found. Please check your invitation link.");
      setStatus("error");
      return;
    }

    const state = session();
    if (state?.isPending) return;

    setStarted(true);

    if (state?.data?.user) {
      handleAcceptInvite(token);
    } else {
      // Not logged in — hand the token to the auth funnel, which carries it
      // through signup and email verification back to this page.
      window.location.href = withInvite("/login", token);
    }
  });

  return (
    <>
      <Title>Accept Invitation</Title>
      <main class="flex min-h-dvh items-center justify-center bg-background px-6">
        <div class="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <Show
            when={status() === "loading"}
            fallback={
              status() === "success" ? (
                <>
                  <div class="text-lg font-medium text-foreground">Invitation accepted!</div>
                  <p class="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
                </>
              ) : (
                <>
                  <div class="text-lg font-medium text-destructive">Invitation failed</div>
                  <p class="text-sm text-muted-foreground">{errorMessage()}</p>
                  <button
                    onClick={() => navigate("/dashboard")}
                    class="mt-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </>
              )
            }
          >
            <div class="text-lg font-medium text-foreground">Accepting invitation...</div>
            <p class="text-sm text-muted-foreground">Please wait while we process your request.</p>
          </Show>
        </div>
      </main>
    </>
  );
}
