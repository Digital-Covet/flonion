import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import {
  createResource,
  createSignal,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useApp } from "~/components/app/context";
import { isLoading, settled } from "~/components/dashboard/data";
import { Skeleton } from "~/components/dashboard/ui";
import {
  BackToSections,
  type NavSection,
  SectionLink,
  SectionNav,
  SectionSkeleton,
} from "~/components/settings/ui";
import {
  canManageTeam,
  loadInvitations,
  loadJoinRequests,
  loadMembers,
  pendingCount,
  type Viewer,
} from "~/components/team/data";
import {
  InvitationsPanel,
  JoinRequestsPanel,
  MemberOnlyNotice,
  MembersPanel,
} from "~/components/team/panels";
import { cn } from "~/lib/cn";

/**
 * Team settings (spec §6, `/settings/team`): members, invitations and
 * join-request queues, on the same left section nav as `/settings` and the
 * same list-then-detail below md.
 *
 * Only owners and admins see the last two sections: `GET /api/team/invitations`
 * and `GET /api/team/join-requests` answer 403 to everyone else, because both
 * list the email addresses of people who are not on the team.
 */

const MEMBERS = "members";

type TeamSectionId = "members" | "invitations" | "requests";

function isSectionId(value: string | undefined): value is TeamSectionId {
  return value === MEMBERS || value === "invitations" || value === "requests";
}

/** Three nav rows while the section list loads, so the page doesn't jump. */
function NavSkeleton() {
  return (
    <div aria-hidden="true" class="flex flex-col gap-1">
      <Skeleton class="h-11 w-full" />
      <Skeleton class="h-11 w-full opacity-70" />
      <Skeleton class="h-11 w-full opacity-50" />
    </div>
  );
}

export default function TeamSettingsPage() {
  const { business, refetchBusiness } = useApp();
  const info = () => business.latest;

  const viewer = (): Viewer | undefined => {
    const data = info();
    if (!data) return undefined;
    return {
      userId: data.currentUserId,
      isOwner: data.isOwner,
      role: data.role,
    };
  };
  const manage = () => canManageTeam(viewer());

  /* ── section, kept in the URL so a link can open one directly ── */
  const [params, setParams] = useSearchParams();
  const raw = () =>
    Array.isArray(params.section) ? params.section[0] : params.section;
  const section = (): TeamSectionId | null => {
    const value = raw();
    return isSectionId(value) ? value : null;
  };
  /** A member who deep-links into a managed queue lands on Members instead. */
  const allowed = (id: TeamSectionId) => id === MEMBERS || manage();
  const shown = (): TeamSectionId => {
    const current = section();
    return current && allowed(current) ? current : MEMBERS;
  };
  const [navigated, setNavigated] = createSignal(false);

  function open(id: TeamSectionId) {
    setNavigated(true);
    setParams({ section: id }, { replace: true, scroll: false });
  }
  function close() {
    setNavigated(false);
    setParams({ section: undefined }, { replace: true, scroll: false });
  }
  const focusHeading = (id: TeamSectionId) => navigated() && shown() === id;

  /* ── the three listings ── */
  // Fetching starts after mount: these API routes need the browser's cookies,
  // so nothing runs during SSR. The two managed listings wait for the business
  // as well, since a member must not fire a request that answers 403.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [members, { refetch: refetchMembers }] = createResource(
    () => ready() || undefined,
    loadMembers,
  );
  const [invitations, { refetch: refetchInvitations }] = createResource(
    () => (ready() && manage()) || undefined,
    loadInvitations,
  );
  const [requests, { refetch: refetchRequests }] = createResource(
    () => (ready() && manage()) || undefined,
    loadJoinRequests,
  );

  const memberRows = () => settled(members) ?? [];
  const invitationRows = () => settled(invitations) ?? [];
  const requestRows = () => settled(requests) ?? [];

  const [announce, setAnnounce] = createSignal("");

  /**
   * Every change reloads what it could have altered rather than patching the
   * list in place: approving a join request adds a member, and removing one
   * changes the team the rest of the app reads from `GET /api/business`.
   */
  function afterMemberChange(message: string) {
    setAnnounce(message);
    refetchMembers();
    refetchBusiness();
  }

  const sections = (): NavSection<TeamSectionId>[] => {
    const count = memberRows().length;
    const list: NavSection<TeamSectionId>[] = [
      {
        id: MEMBERS,
        label: "Members",
        summary: count
          ? `${count} ${count === 1 ? "person" : "people"} on the team`
          : "Who can sign in to this business",
      },
    ];
    if (!manage()) return list;

    const waitingInvites = pendingCount(invitationRows());
    const waitingRequests = pendingCount(requestRows());
    list.push(
      {
        id: "invitations",
        label: "Invitations",
        summary: waitingInvites
          ? `${waitingInvites} waiting to be accepted`
          : "Invite someone by email",
      },
      {
        id: "requests",
        label: "Join requests",
        summary: waitingRequests
          ? `${waitingRequests} waiting for your answer`
          : "People asking to join",
      },
    );
    return list;
  };

  /** The business decides which sections exist, so the page waits for it. */
  // A failed load throws from `.latest` into the page-level ErrorBoundary in
  // AppShell, so there is no error state to hold this open for.
  const loading = () => !info();

  return (
    <>
      <Title>Team · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {announce()}
      </p>

      <div class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Team
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              The people who answer reviews, run tasks, and meet partners with
              you.
            </p>
          </div>
          <SectionLink href="/settings" label="Business settings" />
        </header>

        <Show when={info() && !manage()}>
          <MemberOnlyNotice />
        </Show>

        <div class="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-start">
          {/* Desktop: persistent left nav. Mobile: the list half of list-then-detail. */}
          <div
            class={cn(
              "md:sticky md:top-8",
              section() ? "hidden md:block" : "block",
            )}
          >
            <Show when={!loading()} fallback={<NavSkeleton />}>
              <div class="hidden md:block">
                <SectionNav
                  items={sections()}
                  label="Team sections"
                  current={shown()}
                  onSelect={open}
                />
              </div>
              <div class="rounded-lg border border-border bg-surface p-2 md:hidden">
                <SectionNav
                  items={sections()}
                  label="Team sections"
                  current={null}
                  onSelect={open}
                  detailed
                />
              </div>
            </Show>
          </div>

          <div class={cn("min-w-0", section() ? "block" : "hidden md:block")}>
            <Show when={section()}>
              <div class="mb-2">
                <BackToSections onClick={close} />
              </div>
            </Show>

            <Show when={!loading()} fallback={<SectionSkeleton fields={3} />}>
              <Switch>
                <Match when={shown() === MEMBERS}>
                  <MembersPanel
                    focusHeading={focusHeading(MEMBERS)}
                    members={memberRows()}
                    viewerId={viewer()?.userId ?? ""}
                    canManage={manage()}
                    loading={isLoading(members)}
                    failed={members.state === "errored"}
                    onRetry={() => refetchMembers()}
                    onDone={afterMemberChange}
                    onInvite={() => open("invitations")}
                  />
                </Match>
                <Match when={shown() === "invitations"}>
                  <InvitationsPanel
                    focusHeading={focusHeading("invitations")}
                    invitations={invitationRows()}
                    loading={isLoading(invitations)}
                    failed={invitations.state === "errored"}
                    onRetry={() => refetchInvitations()}
                    onDone={(message) => {
                      setAnnounce(message);
                      refetchInvitations();
                    }}
                  />
                </Match>
                <Match when={shown() === "requests"}>
                  <JoinRequestsPanel
                    focusHeading={focusHeading("requests")}
                    requests={requestRows()}
                    loading={isLoading(requests)}
                    failed={requests.state === "errored"}
                    onRetry={() => refetchRequests()}
                    onDone={(message) => {
                      refetchRequests();
                      afterMemberChange(message);
                    }}
                  />
                </Match>
              </Switch>
            </Show>
          </div>
        </div>
      </div>
    </>
  );
}
