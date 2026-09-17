import { Title } from "@solidjs/meta";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button, ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { CopyButton } from "~/components/ui/copy-button";
import { SubmittedCheck } from "~/components/ui/redirect-countdown";
import { Skeleton, WidgetError } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import { authClient } from "~/lib/auth-client";
import { withInvite } from "~/lib/invite-redirect";
import { getRoleLabel } from "~/lib/roles";

interface InspectedInvitation {
  businessName: string;
  role: string;
  inviterName: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();

  // No auto-accept on mount: accepting is destructive (it can delete an empty
  // owned business), so the user inspects first, then clicks explicitly.
  const [status, setStatus] = createSignal<
    | "inspecting"
    | "inspect"
    | "accepting"
    | "success"
    | "confirm"
    | "declining"
    | "declined"
    | "error"
  >("inspecting");
  const [invitation, setInvitation] = createSignal<InspectedInvitation | null>(
    null,
  );
  const [ownedBusinessName, setOwnedBusinessName] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    const raw =
      searchParams.token ??
      new URLSearchParams(window.location.search).get("token");
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  // Pre-flight inspection: who invited me, to what, as which role, until when.
  // check-invite is session-scoped (latest pending invite for this email).
  const inspect = async () => {
    setStatus("inspecting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/team/check-invite");
      if (res.status === 401) {
        const token = getToken();
        window.location.href = withInvite("/login", token ?? "");
        return;
      }
      if (!res.ok) throw new Error("lookup failed");
      const data = await res.json();
      if (!data.invitation) {
        setErrorMessage(
          "No pending invitation found for your account. It may have expired, been revoked, or been sent to a different email address.",
        );
        setStatus("error");
        return;
      }
      setInvitation({
        businessName: data.invitation.business.name,
        role: data.invitation.role,
        inviterName:
          data.invitation.invitedBy.name || data.invitation.invitedBy.email,
        expiresAt: data.invitation.expiresAt,
      });
      setOwnedBusinessName(data.ownedBusiness?.name ?? "");
      setStatus("inspect");
    } catch {
      setErrorMessage(
        "Couldn't look up your invitation. Check your connection and retry.",
      );
      setStatus("error");
    }
  };

  const handleAcceptInvite = async (confirmDelete = false) => {
    const token = getToken();
    if (!token) {
      setErrorMessage(
        "No invitation token found. Please check your invitation link.",
      );
      setStatus("error");
      return;
    }
    setStatus("accepting");
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
        notify("success", "Invitation accepted");
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

  const handleDecline = async () => {
    const token = getToken();
    if (!token) {
      setErrorMessage(
        "No invitation token found. Please check your invitation link.",
      );
      setStatus("error");
      return;
    }
    setStatus("declining");
    try {
      const res = await fetch("/api/team/decline-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMessage(data?.error ?? "Couldn't decline the invitation.");
        setStatus("error");
        return;
      }
      setStatus("declined");
      notify("success", "Invitation declined");
    } catch {
      setErrorMessage("Couldn't decline the invitation. Please try again.");
      setStatus("error");
    }
  };

  const [started, setStarted] = createSignal(false);

  // Driven off the session store rather than a fixed timeout: a slow hydration
  // used to fire API calls before the cookie was readable (spurious 401).
  // Logged-out users are handed to the auth funnel with the token; signed-in
  // users get the inspection card — nothing is auto-accepted.
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
      void inspect();
    } else {
      // Not logged in — hand the token to the auth funnel, which carries it
      // through signup and email verification back to this page.
      window.location.href = withInvite("/login", token);
    }
  });

  const expiryLabel = () => {
    const iso = invitation()?.expiresAt;
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <Title>Accept Invitation</Title>
      <main class="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
        <Card class="w-full max-w-md" padded={false}>
          <div class="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
            <Show when={status() === "inspecting"}>
              <div class="grid w-full gap-3" aria-hidden="true">
                <Skeleton class="mx-auto h-12 w-12 rounded-full" />
                <Skeleton class="mx-auto h-6 w-48" />
                <Skeleton class="mx-auto h-4 w-64" />
                <Skeleton class="h-11 w-full" />
              </div>
              <p class="sr-only" role="status">
                Looking up your invitation…
              </p>
            </Show>

            <Show when={status() === "inspect" && invitation()}>
              <h1 class="font-heading text-2xl font-semibold text-foreground">
                You've been invited!
              </h1>
              <p class="text-sm text-muted-foreground">
                <span class="font-medium text-foreground">
                  {invitation()!.inviterName}
                </span>{" "}
                invited you to join{" "}
                <span class="font-medium text-foreground">
                  {invitation()!.businessName}
                </span>{" "}
                as{" "}
                <span class="font-medium text-foreground">
                  {getRoleLabel(invitation()!.role)}
                </span>
                .
              </p>
              <div class="flex flex-wrap items-center justify-center gap-2">
                <Badge tone="neutral">Expires {expiryLabel()}</Badge>
                <Show when={ownedBusinessName()}>
                  <Badge tone="warning">
                    Joining deletes “{ownedBusinessName()}”
                  </Badge>
                </Show>
              </div>
              <div class="grid w-full gap-2">
                <Button onClick={() => handleAcceptInvite(false)}>
                  Accept invitation
                </Button>
                <Button variant="outline" onClick={handleDecline}>
                  Decline
                </Button>
              </div>
              <div class="w-full border-t border-border pt-3 text-left">
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invite token
                </p>
                <p class="tnum mt-1 truncate font-mono text-xs text-muted-foreground">
                  {getToken()}
                </p>
                <CopyButton
                  value={() => getToken() ?? ""}
                  label="Copy invite link"
                  copiedLabel="Copied"
                  size="sm"
                  class="mt-2"
                />
              </div>
            </Show>

            <Show when={status() === "accepting" || status() === "declining"}>
              <div
                class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
                aria-hidden="true"
              />
              <p class="text-sm text-muted-foreground" role="status">
                {status() === "accepting"
                  ? "Accepting invitation…"
                  : "Declining invitation…"}
              </p>
            </Show>

            <Show when={status() === "success"}>
              <SubmittedCheck />
              <div class="text-lg font-medium text-foreground">
                Invitation accepted!
              </div>
              <p class="text-sm text-muted-foreground">
                Welcome to {invitation()?.businessName ?? "your new team"}.
              </p>
              <ButtonLink href="/dashboard" class="w-full">
                Go to dashboard
              </ButtonLink>
            </Show>

            <Show when={status() === "declined"}>
              <div class="text-lg font-medium text-foreground">
                Invitation declined
              </div>
              <p class="text-sm text-muted-foreground">
                The inviter has been notified. You can still set up your own
                business.
              </p>
              <div class="grid w-full gap-2">
                <ButtonLink href="/onboarding" class="w-full">
                  Set up my business
                </ButtonLink>
                <ButtonLink href="/dashboard" variant="outline" class="w-full">
                  Go to dashboard
                </ButtonLink>
              </div>
            </Show>

            <Show when={status() === "confirm"}>
              <div class="text-lg font-medium text-foreground">
                Delete "{ownedBusinessName()}" and join this team?
              </div>
              <p class="text-sm text-muted-foreground">
                You can only belong to one business. "{ownedBusinessName()}" is
                empty — nothing has been added to it — so joining will
                permanently delete it. This can't be undone.
              </p>
              <div class="mt-2 grid w-full gap-2 sm:grid-cols-2">
                <Button
                  variant="destructive"
                  onClick={() => handleAcceptInvite(true)}
                >
                  Delete and join
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Keep my business
                </Button>
              </div>
            </Show>

            <Show when={status() === "error"}>
              <WidgetError
                message={errorMessage()}
                onRetry={() => void inspect()}
                retryLabel="Retry"
              />
              <ButtonLink href="/dashboard" variant="outline" class="w-full">
                Go to dashboard
              </ButtonLink>
            </Show>
          </div>
        </Card>
      </main>
    </>
  );
}
