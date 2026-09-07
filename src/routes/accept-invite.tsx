import { Title } from "@solidjs/meta";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { authClient } from "~/lib/auth-client";
import { withInvite } from "~/lib/invite-redirect";

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();

  const [status, setStatus] = createSignal<
    "loading" | "error" | "success" | "confirm"
  >("loading");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [ownedBusinessName, setOwnedBusinessName] = createSignal("");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    const raw =
      searchParams.token ??
      new URLSearchParams(window.location.search).get("token");
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const handleAcceptInvite = async (token: string, confirmDelete = false) => {
    setStatus("loading");
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ...(confirmDelete ? { confirmDeleteOwnedBusiness: true } : {}),
        }),
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }

      const data = await res.json().catch(() => null);

      // Accepting costs them the empty business they own. Never done silently:
      // the server refuses until the UI has named it and the user agreed.
      if (res.status === 409 && data?.requiresConfirmation) {
        setOwnedBusinessName(data.ownedBusiness?.name ?? "your business");
        setStatus("confirm");
        return;
      }

      const blockers =
        Array.isArray(data?.blockers) && data.blockers.length > 0
          ? ` (${data.blockers.join(", ")})`
          : "";
      setErrorMessage(
        `${data?.error ?? "Failed to accept invitation"}${blockers}`,
      );
      setStatus("error");
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
      setErrorMessage(
        "No invitation token found. Please check your invitation link.",
      );
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
          <Show when={status() === "loading"}>
            <div class="text-lg font-medium text-foreground">
              Accepting invitation...
            </div>
            <p class="text-sm text-muted-foreground">
              Please wait while we process your request.
            </p>
          </Show>

          <Show when={status() === "success"}>
            <div class="text-lg font-medium text-foreground">
              Invitation accepted!
            </div>
            <p class="text-sm text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </Show>

          <Show when={status() === "confirm"}>
            <div class="text-lg font-medium text-foreground">
              Delete "{ownedBusinessName()}" and join this team?
            </div>
            <p class="text-sm text-muted-foreground">
              You can only belong to one business. "{ownedBusinessName()}" is
              empty — nothing has been added to it — so joining will permanently
              delete it. This can't be undone.
            </p>
            <div class="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  const token = getToken();
                  if (token) handleAcceptInvite(token, true);
                }}
                class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors"
              >
                Delete and join
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                class="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Keep my business
              </button>
            </div>
          </Show>

          <Show when={status() === "error"}>
            <div class="text-lg font-medium text-destructive">
              Invitation failed
            </div>
            <p class="text-sm text-muted-foreground">{errorMessage()}</p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              class="mt-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary-hover transition-colors"
            >
              Go to Dashboard
            </button>
          </Show>
        </div>
      </main>
    </>
  );
}
