import { Title } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import {
  IconBriefcase,
  IconLink,
  IconPencil,
  IconStar,
} from "@tabler/icons-solidjs";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useApp } from "~/components/app/context";
import {
  loadContacts,
  loadProfile,
  loadProjects,
  loadServices,
} from "~/components/company/data";
import {
  ContactRow,
  ProfileHero,
  ProfileSkeleton,
  ProjectTile,
  SectionEmpty,
  SectionHeading,
  ServiceTile,
  StatRow,
  sectionClass,
} from "~/components/company/widgets";
import { WidgetError } from "~/components/dashboard/ui";
import { btnPrimary, btnSecondary, Notice } from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

/**
 * A business as a partner reads it.
 *
 * Read-only on purpose, for the owner too. Managing these three sections —
 * adding, editing, and the order they appear in — lives at `/marketplace/
 * projects`, so there is one place that writes them and this page stays the
 * thing it is shown as: the public face of the business.
 */

/** Where the owner goes to change anything on this page. */
const MANAGE_HREF = "/marketplace/projects";

export default function CompanyProfilePage() {
  const params = useParams();
  const identifier = () => params.username ?? "";
  const { business } = useApp();

  // API routes need the browser's cookies, so nothing fetches during SSR.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const [profile, { refetch: refetchProfile }] = createResource(
    () => (ready() && identifier() ? identifier() : undefined),
    loadProfile,
  );

  const businessId = () => profile()?.id;
  const [services] = createResource(businessId, loadServices);
  const [projects] = createResource(businessId, loadProjects);
  const [contacts] = createResource(businessId, loadContacts);

  /** Whether the signed-in owner is looking at their *own* profile. */
  const isOwner = createMemo(() => {
    const mine = business();
    const shown = profile();
    return Boolean(
      mine && shown && mine.isOwner && mine.businessId === shown.id,
    );
  });

  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal<string>();

  const serviceList = () => services() ?? [];
  const projectList = () => projects() ?? [];
  const contactList = () => contacts() ?? [];

  async function copyLink() {
    const handle = profile()?.username ?? businessId();
    if (!handle) return;
    const url = `${window.location.origin}/company/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setError(undefined);
      setMessage("Profile link copied.");
    } catch {
      setError(`Couldn't copy automatically — the link is ${url}`);
    }
  }

  const reviewHref = () =>
    profile()?.username ? `/company/${profile()!.username}/review` : null;

  /** Empty sections read differently to the owner, who can go and fill them. */
  const emptyText = (mine: string, theirs: string) =>
    isOwner() ? mine : theirs;

  return (
    <>
      <Title>
        {profile()
          ? `${profile()!.name} · Flonion`
          : "Company profile · Flonion"}
      </Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-4">
        <Show when={error()}>
          {(text) => <Notice tone="error">{text()}</Notice>}
        </Show>

        <Switch>
          <Match when={profile.loading || !ready()}>
            <ProfileSkeleton />
          </Match>

          <Match when={profile.error}>
            <WidgetError what="this profile" onRetry={() => refetchProfile()} />
          </Match>

          <Match when={!profile()}>
            <div class={sectionClass}>
              <EmptyState
                icon={IconBriefcase}
                title="Profile not found"
                action={
                  <A href="/marketplace" class={btnSecondary}>
                    Browse the marketplace
                  </A>
                }
              >
                No business is published at{" "}
                <span class="font-mono">/company/{identifier()}</span> yet.
              </EmptyState>
            </div>
          </Match>

          <Match when={profile()}>
            {(shown) => (
              <>
                <ProfileHero
                  profile={shown()}
                  notice={
                    isOwner() ? (
                      <Notice tone="info">
                        This is your public profile — partners in the
                        marketplace land here. Change what's on it, and the
                        order it appears in, under{" "}
                        <A
                          href={MANAGE_HREF}
                          class="font-medium underline underline-offset-4"
                        >
                          Projects
                        </A>
                        .
                      </Notice>
                    ) : undefined
                  }
                  actions={
                    <Show
                      when={isOwner()}
                      fallback={
                        <>
                          <Show when={reviewHref()}>
                            {(href) => (
                              <a href={href()} class={btnPrimary}>
                                <IconStar aria-hidden="true" class="size-4" />
                                Leave a review
                              </a>
                            )}
                          </Show>
                          <A href="/marketplace" class={btnSecondary}>
                            Back to marketplace
                          </A>
                        </>
                      }
                    >
                      <A href={MANAGE_HREF} class={btnPrimary}>
                        <IconPencil aria-hidden="true" class="size-4" />
                        Edit in Projects
                      </A>
                      <button
                        type="button"
                        onClick={copyLink}
                        class={btnSecondary}
                      >
                        <IconLink aria-hidden="true" class="size-4" />
                        Copy link
                      </button>
                    </Show>
                  }
                />

                <StatRow
                  profile={shown()}
                  services={serviceList().length}
                  projects={projectList().length}
                />

                {/* Services */}
                <section
                  aria-labelledby="services-heading"
                  class={cn(sectionClass, "flex flex-col gap-4")}
                >
                  <SectionHeading
                    id="services-heading"
                    title="Services"
                    lead="What this business sells."
                  />

                  <Show
                    when={serviceList().length > 0}
                    fallback={
                      <SectionEmpty>
                        {emptyText(
                          "No services listed yet — add the two or three you want to be called about under Projects.",
                          "This business hasn't listed its services yet.",
                        )}
                      </SectionEmpty>
                    }
                  >
                    <ul class="grid gap-3 sm:grid-cols-2">
                      <For each={serviceList()}>
                        {(service) => <ServiceTile service={service} />}
                      </For>
                    </ul>
                  </Show>
                </section>

                {/* Portfolio */}
                <section
                  aria-labelledby="work-heading"
                  class={cn(sectionClass, "flex flex-col gap-4")}
                >
                  <SectionHeading
                    id="work-heading"
                    title="Portfolio"
                    lead="Work worth showing, newest thinking first."
                  />

                  <Show
                    when={projectList().length > 0}
                    fallback={
                      <SectionEmpty>
                        {emptyText(
                          "Nothing in your portfolio yet — add a few images of work you're proud of under Projects.",
                          "This business hasn't published any work yet.",
                        )}
                      </SectionEmpty>
                    }
                  >
                    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <For each={projectList()}>
                        {(project) => <ProjectTile project={project} />}
                      </For>
                    </ul>
                  </Show>
                </section>

                {/* Contacts */}
                <section
                  aria-labelledby="contacts-heading"
                  class={cn(sectionClass, "flex flex-col gap-4")}
                >
                  <SectionHeading
                    id="contacts-heading"
                    title="Who to talk to"
                    lead="The people a partner should reach out to."
                  />

                  <Show
                    when={contactList().length > 0}
                    fallback={
                      <SectionEmpty>
                        {emptyText(
                          "No contacts yet — add yourself under Projects so partners know who picks up.",
                          "No contacts published yet.",
                        )}
                      </SectionEmpty>
                    }
                  >
                    <ul class="flex flex-col gap-2">
                      <For each={contactList()}>
                        {(contact) => <ContactRow contact={contact} />}
                      </For>
                    </ul>
                  </Show>
                </section>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </>
  );
}
