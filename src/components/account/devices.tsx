import {
  IconCircleCheck,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDevices,
  IconDeviceTablet,
  IconLogout,
} from "@tabler/icons-solidjs";
import {
  type Component,
  createResource,
  createSignal,
  For,
  type JSX,
  onMount,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { AccountPanel, StatusChip } from "~/components/account/ui";
import { relativeTime } from "~/components/dashboard/data";
import { Skeleton, WidgetError } from "~/components/dashboard/ui";
import {
  api,
  btnSecondary,
  ConfirmDialog,
  NETWORK_ERROR,
  Notice,
} from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";
import { type DeviceKind, deviceLabel } from "~/lib/user-agent";

/** One row of `GET /api/account/sessions`. */
interface DeviceSession {
  id: string;
  current: boolean;
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
}

const KIND_ICON: Record<
  DeviceKind,
  Component<JSX.SvgSVGAttributes<SVGSVGElement>>
> = {
  desktop: IconDeviceDesktop,
  mobile: IconDeviceMobile,
  tablet: IconDeviceTablet,
  unknown: IconDevices,
};

const LOGIN_AGAIN = "/login?callbackURL=/account?section=devices";

type Pending = { kind: "one"; session: DeviceSession } | { kind: "others" };

function signedInOn(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Every browser and phone signed in to this account, with a way to end any of
 * them. The current device is marked and can't be logged out from here — the
 * account menu's Log out does that — so nobody locks themselves out by
 * mistake.
 */
export function DevicesPanel(props: { focusHeading?: boolean }) {
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [list, { refetch, mutate }] = createResource<
    DeviceSession[] | "error",
    boolean
  >(ready, async () => {
    try {
      const { ok, status, data } = await api<{ sessions: DeviceSession[] }>(
        "/api/account/sessions",
      );
      if (status === 401) {
        window.location.assign(LOGIN_AGAIN);
        return "error";
      }
      return ok && data.sessions ? data.sessions : "error";
    } catch {
      return "error";
    }
  });
  // `.state`, not a call: a suspending read would blank the account page
  // while the list loads (see the Google status resource in /settings).
  const sessions = () =>
    list.state === "ready" || list.state === "refreshing"
      ? list.latest
      : undefined;
  const loaded = () => {
    const value = sessions();
    return Array.isArray(value) ? value : undefined;
  };
  const others = () => loaded()?.filter((s) => !s.current) ?? [];

  const [confirming, setConfirming] = createSignal<Pending>();
  const [pending, setPending] = createSignal(false);
  const [banner, setBanner] = createSignal<{
    tone: "error" | "success";
    text: string;
  }>();
  const [announce, setAnnounce] = createSignal("");

  async function revoke() {
    const target = confirming();
    if (!target || pending()) return;
    setPending(true);
    setBanner(undefined);
    try {
      const { ok, status, data } = await api<unknown>(
        target.kind === "one"
          ? `/api/account/sessions/${encodeURIComponent(target.session.id)}`
          : "/api/account/sessions",
        { method: "DELETE" },
      );
      if (status === 401) {
        window.location.assign(LOGIN_AGAIN);
        return;
      }
      // Already gone (it expired, or was logged out elsewhere): same outcome.
      if (!ok && !(target.kind === "one" && status === 404)) {
        setBanner({
          tone: "error",
          text: data.error ?? "We couldn't log that device out. Try again.",
        });
        return;
      }

      const current = loaded() ?? [];
      if (target.kind === "one") {
        mutate(current.filter((s) => s.id !== target.session.id));
        const name = deviceLabel(target.session);
        setBanner({ tone: "success", text: `${name} is logged out.` });
        setAnnounce(`${name} logged out`);
      } else {
        mutate(current.filter((s) => s.current));
        setBanner({
          tone: "success",
          text: "Every other device is logged out. This one stays signed in.",
        });
        setAnnounce("Other devices logged out");
      }
      setConfirming(undefined);
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountPanel
      id="devices"
      title="Devices"
      lead="Where you're logged in right now. If you don't recognise a device, log it out and change your password."
      focusHeading={props.focusHeading}
    >
      <p aria-live="polite" class="sr-only">
        {announce()}
      </p>

      <div class="flex flex-col gap-4">
        <Show when={banner()}>
          {(note) => <Notice tone={note().tone}>{note().text}</Notice>}
        </Show>

        <Show when={sessions() === "error"}>
          <WidgetError what="your devices" onRetry={() => refetch()} />
        </Show>

        <Show when={!sessions()}>
          <div aria-busy="true" class="flex flex-col gap-3">
            <span class="sr-only">Loading your devices…</span>
            <Skeleton class="h-16 w-full" />
            <Skeleton class="h-16 w-full opacity-70" />
          </div>
        </Show>

        <Show when={loaded()}>
          {(rows) => (
            <>
              <ul class="flex flex-col divide-y divide-border rounded-md border border-border">
                <For each={rows()}>
                  {(session) => (
                    <DeviceRow
                      session={session}
                      onLogOut={() => setConfirming({ kind: "one", session })}
                    />
                  )}
                </For>
              </ul>

              <p class="text-sm text-text-muted">
                "Last active" updates about once a day.
              </p>

              <Show
                when={others().length > 0}
                fallback={
                  <p class="text-sm text-text">
                    Only this device is logged in.
                  </p>
                }
              >
                <button
                  type="button"
                  onClick={() => setConfirming({ kind: "others" })}
                  class={cn(
                    btnSecondary,
                    "min-h-11 w-full px-4 text-sm sm:w-auto sm:self-start",
                  )}
                >
                  <IconLogout aria-hidden="true" class="size-4" />
                  Log out all other devices
                </button>
              </Show>
            </>
          )}
        </Show>
      </div>

      <ConfirmDialog
        open={Boolean(confirming())}
        title={
          confirming()?.kind === "others"
            ? "Log out all other devices?"
            : "Log out this device?"
        }
        description={(() => {
          const target = confirming();
          if (target?.kind === "one") {
            return `${deviceLabel(target.session)} will need to log in again to use Flonion. This device stays signed in.`;
          }
          return "Every phone, tablet and computer except this one will need to log in again.";
        })()}
        confirmLabel={
          confirming()?.kind === "others" ? "Log out all" : "Log out"
        }
        pending={pending()}
        onConfirm={revoke}
        onClose={() => {
          if (!pending()) setConfirming(undefined);
        }}
      />
    </AccountPanel>
  );
}

function DeviceRow(props: { session: DeviceSession; onLogOut: () => void }) {
  return (
    <li class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
          <Dynamic
            component={KIND_ICON[props.session.kind]}
            aria-hidden="true"
            class="size-5"
          />
        </span>
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 text-base font-medium text-text">
            {deviceLabel(props.session)}
            <Show when={props.session.current}>
              <StatusChip tone="success" icon={IconCircleCheck}>
                This device
              </StatusChip>
            </Show>
          </p>
          <p class="mt-0.5 text-sm text-text-muted">
            <Show when={!props.session.current} fallback="Active now">
              Last active {relativeTime(props.session.lastActiveAt)}
            </Show>
            <Show when={props.session.ipAddress}>
              {(ip) => <span class="break-all"> · {ip()}</span>}
            </Show>
          </p>
          <p class="text-sm text-text-muted">
            Logged in {signedInOn(props.session.createdAt)}
          </p>
        </div>
      </div>

      <Show when={!props.session.current}>
        <button
          type="button"
          onClick={() => props.onLogOut()}
          aria-label={`Log out ${deviceLabel(props.session)}`}
          class={cn(
            btnSecondary,
            "min-h-11 w-full shrink-0 px-4 text-sm sm:w-auto",
          )}
        >
          Log out
        </button>
      </Show>
    </li>
  );
}
