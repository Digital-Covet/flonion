import { Tabs } from "@ark-ui/solid/tabs";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import {
  IconAddressBook,
  IconBriefcase,
  IconExternalLink,
  IconLink,
  IconPencil,
  IconPhoto,
  IconPhotoPlus,
  IconPlus,
  IconUserPlus,
} from "@tabler/icons-solidjs";
import {
  createMemo,
  createResource,
  createSignal,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { type BusinessInfo, useApp } from "~/components/app/context";
import { profileHref } from "~/components/app/nav";
import {
  type CompanyContact,
  type CompanyProfile,
  type CompanyProject,
  type CompanyService,
  type ContactDraft,
  createContact,
  createProject,
  createService,
  deleteContact,
  deleteProject,
  deleteService,
  loadContacts,
  loadProjects,
  loadServices,
  nextPosition,
  type PortfolioKind,
  type ProfileDraft,
  type ProjectDraft,
  type ServiceDraft,
  saveOrder,
  saveProfileDetails,
  syncPositions,
  updateContact,
  updateProject,
  updateService,
} from "~/components/company/data";
import {
  ContactDialog,
  ProfileDialog,
  ProjectDialog,
  ServiceDialog,
} from "~/components/company/editors";
import {
  ContactRow,
  ProjectTile,
  RowActions,
  SectionHeading,
  ServiceTile,
  sectionClass,
} from "~/components/company/widgets";
import { WidgetError } from "~/components/dashboard/ui";
import {
  PanelHeader,
  PanelSkeleton,
  ReorderableList,
  RowToolbar,
  TabCount,
  tabListClass,
  tabTriggerClass,
} from "~/components/marketplace/portfolio";
import {
  btnPrimary,
  btnSecondary,
  ConfirmDialog,
  Notice,
} from "~/components/onboarding/ui";
import { EmptyState } from "~/components/reviews/inbox";
import { cn } from "~/lib/cn";

/**
 * Portfolio manager (spec §6, `/marketplace/projects`).
 *
 * The one place a business's own listing is written. `/company/:username`
 * renders the same three sections for a partner to read and is read-only for
 * everyone, including the owner — the two used to both edit these rows, which
 * left no answer to "where do I change this?". Every section is served
 * `position` ascending, so the order set here is the order a partner meets the
 * business in.
 */

const TABS = ["services", "projects", "contacts"] as const;
type TabValue = (typeof TABS)[number];

const addButtonClass = cn(btnSecondary, "min-h-9 px-3 text-sm");

export default function PortfolioProjectsPage() {
  const { business, refetchBusiness } = useApp();
  const [params, setParams] = useSearchParams();

  /** Tab lives in the URL so a reload, or a shared link, lands in the same place. */
  const tab = (): TabValue => {
    const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    return TABS.includes(raw as TabValue) ? (raw as TabValue) : "services";
  };

  // API routes need the browser's cookies, so nothing fetches during SSR.
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));

  const businessId = () => (ready() ? business()?.businessId : undefined);

  const [services, { refetch: refetchServices, mutate: mutateServices }] =
    createResource(businessId, loadServices);
  const [projects, { refetch: refetchProjects, mutate: mutateProjects }] =
    createResource(businessId, loadProjects);
  const [contacts, { refetch: refetchContacts, mutate: mutateContacts }] =
    createResource(businessId, loadContacts);

  const serviceList = () => services() ?? [];
  const projectList = () => projects() ?? [];
  const contactList = () => contacts() ?? [];

  /**
   * Only the owner may edit: the three endpoints check
   * `business.userId === session user`, so a member sees the sections read-only
   * rather than controls that would come back 403.
   */
  const isOwner = createMemo(() => Boolean(business()?.isOwner));

  const [editing, setEditing] = createSignal<Editing | null>(null);
  const [removing, setRemoving] = createSignal<Removing | null>(null);
  const [removePending, setRemovePending] = createSignal(false);
  const [saving, setSaving] = createSignal<PortfolioKind | null>(null);
  const [message, setMessage] = createSignal("");
  const [errors, setErrors] = createSignal<
    Partial<Record<PortfolioKind, string>>
  >({});

  const panelError = (kind: PortfolioKind) => errors()[kind];
  const setPanelError = (kind: PortfolioKind, text?: string) =>
    setErrors((current) => ({ ...current, [kind]: text }));

  const done = (text: string, refetch: () => void) => {
    setEditing(null);
    setMessage(text);
    refetch();
  };

  /**
   * Saves a new order. The rows are shown in the new order straight away — a
   * reorder that waits on the network feels broken — but a failure refetches
   * instead of reverting: the positions go out as separate requests, so a
   * partial failure means only the server knows the real order.
   */
  async function commitOrder<T extends { id: string; position: number }>(
    kind: PortfolioKind,
    next: T[],
    mutate: (value: T[]) => unknown,
    refetch: () => void,
  ) {
    const id = businessId();
    if (!id) return;

    setPanelError(kind);
    setSaving(kind);
    // The rows keep their identity, so `For` moves them rather than rebuilding
    // them — which is what lets the grip the owner is holding keep focus. They
    // still carry their stored position, which is what tells `saveOrder` which
    // rows actually moved; that is brought in line once the save lands.
    mutate(next);

    try {
      await saveOrder(kind, id, next);
      syncPositions(next);
      setMessage("New order saved.");
    } catch (err) {
      setPanelError(
        kind,
        err instanceof Error ? err.message : "Couldn't save the new order.",
      );
      refetch();
    } finally {
      setSaving(null);
    }
  }

  async function confirmRemove() {
    const target = removing();
    const id = businessId();
    if (!target || !id) return;

    setRemovePending(true);
    setPanelError(target.kind);
    try {
      if (target.kind === "service") {
        await deleteService(id, target.id);
        refetchServices();
      } else if (target.kind === "project") {
        await deleteProject(id, target.id);
        refetchProjects();
      } else {
        await deleteContact(id, target.id);
        refetchContacts();
      }
      setMessage(`${target.label} removed.`);
      setRemoving(null);
    } catch (err) {
      setPanelError(
        target.kind,
        err instanceof Error ? err.message : "Couldn't remove that.",
      );
    } finally {
      setRemovePending(false);
    }
  }

  async function copyProfileLink() {
    const href = profileHref(business());
    if (!href) return;
    const url = `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Profile link copied.");
    } catch {
      setMessage(`Couldn't copy automatically — the link is ${url}`);
    }
  }

  return (
    <>
      <Title>Projects · Flonion</Title>

      <p aria-live="polite" class="sr-only">
        {message()}
      </p>

      <div class="flex flex-col gap-6">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
              Projects
            </h1>
            <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
              Everything a partner sees on your profile — what you sell, work
              worth showing, and who picks up the phone. Drag a row to change
              the order they read it in.
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap gap-2">
            <Show when={isOwner()}>
              <button
                type="button"
                onClick={() => setEditing({ kind: "profile" })}
                class={cn(btnSecondary, "min-h-11")}
              >
                <IconPencil aria-hidden="true" class="size-4" />
                Business details
              </button>
            </Show>
            <Show when={profileHref(business())}>
              {(href) => (
                <>
                  <button
                    type="button"
                    onClick={copyProfileLink}
                    class={cn(btnSecondary, "min-h-11")}
                  >
                    <IconLink aria-hidden="true" class="size-4" />
                    Copy link
                  </button>
                  <A href={href()} class={cn(btnPrimary, "min-h-11")}>
                    <IconExternalLink aria-hidden="true" class="size-4" />
                    View profile
                  </A>
                </>
              )}
            </Show>
          </div>
        </header>

        <Switch>
          <Match when={!business.latest || !ready()}>
            <div class={cn(sectionClass, "flex flex-col gap-4")}>
              <PanelSkeleton rows={3} />
            </div>
          </Match>

          <Match when={!isOwner()}>
            <div class={sectionClass}>
              <EmptyState
                icon={IconBriefcase}
                title="Only the owner can edit this"
                action={
                  <Show when={profileHref(business())}>
                    {(href) => (
                      <A href={href()} class={btnSecondary}>
                        View the profile
                      </A>
                    )}
                  </Show>
                }
              >
                Services, work and contacts are edited by whoever owns this
                business. Ask them to add you as an owner if that should be you.
              </EmptyState>
            </div>
          </Match>

          <Match when={isOwner()}>
            <Tabs.Root
              value={tab()}
              onValueChange={(details) =>
                setParams({ tab: details.value }, { replace: true })
              }
              class="flex flex-col gap-5"
            >
              <Tabs.List class={tabListClass}>
                <Tabs.Trigger value="services" class={tabTriggerClass}>
                  Services
                  <TabCount value={serviceList().length} />
                </Tabs.Trigger>
                <Tabs.Trigger value="projects" class={tabTriggerClass}>
                  Projects
                  <TabCount value={projectList().length} />
                </Tabs.Trigger>
                <Tabs.Trigger value="contacts" class={tabTriggerClass}>
                  Contacts
                  <TabCount value={contactList().length} />
                </Tabs.Trigger>
              </Tabs.List>

              {/* ── Services ──────────────────────────────────────────── */}
              <Tabs.Content
                value="services"
                class={cn(sectionClass, "flex flex-col gap-4")}
              >
                <PanelHeader
                  id="services-panel-heading"
                  title="Services"
                  lead="What you sell, in the order you want it read. Put the work you actually want calls about first."
                  action={
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "service" })}
                      class={addButtonClass}
                    >
                      <IconPlus aria-hidden="true" class="size-4" />
                      Add service
                    </button>
                  }
                />

                <Show when={panelError("service")}>
                  {(text) => <Notice tone="error">{text()}</Notice>}
                </Show>

                <Switch>
                  <Match when={services.loading}>
                    <PanelSkeleton rows={3} />
                  </Match>

                  <Match when={services.error}>
                    <WidgetError
                      what="your services"
                      onRetry={() => refetchServices()}
                    />
                  </Match>

                  <Match when={serviceList().length === 0}>
                    <EmptyState
                      icon={IconBriefcase}
                      title="No services listed yet"
                      action={
                        <button
                          type="button"
                          onClick={() => setEditing({ kind: "service" })}
                          class={btnPrimary}
                        >
                          <IconPlus aria-hidden="true" class="size-4" />
                          Add your first service
                        </button>
                      }
                    >
                      Add the two or three things you want partners to call you
                      about. One line each is plenty.
                    </EmptyState>
                  </Match>

                  <Match when={serviceList().length > 0}>
                    <ReorderableList
                      items={serviceList()}
                      noun="service"
                      layout="pairs"
                      busy={saving() === "service"}
                      label={(service) => service.title}
                      onMove={(next) => mutateServices(next)}
                      onCommit={(next) =>
                        commitOrder(
                          "service",
                          next,
                          mutateServices,
                          refetchServices,
                        )
                      }
                    >
                      {(service, controls) => (
                        <ServiceTile
                          service={service}
                          actions={
                            <RowToolbar
                              reorder={controls}
                              actions={
                                <RowActions
                                  label={service.title}
                                  busy={saving() === "service"}
                                  onEdit={() =>
                                    setEditing({ kind: "service", service })
                                  }
                                  onDelete={() =>
                                    setRemoving({
                                      kind: "service",
                                      id: service.id,
                                      label: service.title,
                                    })
                                  }
                                />
                              }
                            />
                          }
                        />
                      )}
                    </ReorderableList>
                  </Match>
                </Switch>
              </Tabs.Content>

              {/* ── Projects ──────────────────────────────────────────── */}
              <Tabs.Content
                value="projects"
                class={cn(sectionClass, "flex flex-col gap-4")}
              >
                <PanelHeader
                  id="projects-panel-heading"
                  title="Projects"
                  lead="Work worth showing. The first few are what a partner sees before they scroll, so lead with your best."
                  action={
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "project" })}
                      class={addButtonClass}
                    >
                      <IconPhotoPlus aria-hidden="true" class="size-4" />
                      Add project
                    </button>
                  }
                />

                <Show when={panelError("project")}>
                  {(text) => <Notice tone="error">{text()}</Notice>}
                </Show>

                <Switch>
                  <Match when={projects.loading}>
                    <PanelSkeleton rows={2} />
                  </Match>

                  <Match when={projects.error}>
                    <WidgetError
                      what="your projects"
                      onRetry={() => refetchProjects()}
                    />
                  </Match>

                  <Match when={projectList().length === 0}>
                    <EmptyState
                      icon={IconPhoto}
                      title="Nothing in your portfolio yet"
                      action={
                        <button
                          type="button"
                          onClick={() => setEditing({ kind: "project" })}
                          class={btnPrimary}
                        >
                          <IconPhotoPlus aria-hidden="true" class="size-4" />
                          Add your first project
                        </button>
                      }
                    >
                      A few images of work you're proud of, each with a caption.
                      Link an image you already host.
                    </EmptyState>
                  </Match>

                  <Match when={projectList().length > 0}>
                    <ReorderableList
                      items={projectList()}
                      noun="project"
                      layout="grid"
                      busy={saving() === "project"}
                      label={(project) => project.altText || "this project"}
                      onMove={(next) => mutateProjects(next)}
                      onCommit={(next) =>
                        commitOrder(
                          "project",
                          next,
                          mutateProjects,
                          refetchProjects,
                        )
                      }
                    >
                      {(project, controls) => (
                        <ProjectTile
                          project={project}
                          actions={
                            <RowToolbar
                              reorder={controls}
                              actions={
                                <RowActions
                                  label={project.altText || "this project"}
                                  busy={saving() === "project"}
                                  onEdit={() =>
                                    setEditing({ kind: "project", project })
                                  }
                                  onDelete={() =>
                                    setRemoving({
                                      kind: "project",
                                      id: project.id,
                                      label: project.altText || "Project",
                                    })
                                  }
                                />
                              }
                            />
                          }
                        />
                      )}
                    </ReorderableList>
                  </Match>
                </Switch>
              </Tabs.Content>

              {/* ── Contacts ──────────────────────────────────────────── */}
              <Tabs.Content
                value="contacts"
                class={cn(sectionClass, "flex flex-col gap-4")}
              >
                <PanelHeader
                  id="contacts-panel-heading"
                  title="Contacts"
                  lead="Who a partner should reach out to, and what they handle. The first name is the one most people will use."
                  action={
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "contact" })}
                      class={addButtonClass}
                    >
                      <IconUserPlus aria-hidden="true" class="size-4" />
                      Add contact
                    </button>
                  }
                />

                <Show when={panelError("contact")}>
                  {(text) => <Notice tone="error">{text()}</Notice>}
                </Show>

                <Switch>
                  <Match when={contacts.loading}>
                    <PanelSkeleton rows={3} />
                  </Match>

                  <Match when={contacts.error}>
                    <WidgetError
                      what="your contacts"
                      onRetry={() => refetchContacts()}
                    />
                  </Match>

                  <Match when={contactList().length === 0}>
                    <EmptyState
                      icon={IconAddressBook}
                      title="No contacts yet"
                      action={
                        <button
                          type="button"
                          onClick={() => setEditing({ kind: "contact" })}
                          class={btnPrimary}
                        >
                          <IconUserPlus aria-hidden="true" class="size-4" />
                          Add your first contact
                        </button>
                      }
                    >
                      Add yourself so partners know who picks up, then anyone
                      else who handles enquiries.
                    </EmptyState>
                  </Match>

                  <Match when={contactList().length > 0}>
                    <ReorderableList
                      items={contactList()}
                      noun="contact"
                      layout="rows"
                      busy={saving() === "contact"}
                      label={(contact) => contact.name}
                      onMove={(next) => mutateContacts(next)}
                      onCommit={(next) =>
                        commitOrder(
                          "contact",
                          next,
                          mutateContacts,
                          refetchContacts,
                        )
                      }
                    >
                      {(contact, controls) => (
                        <ContactRow
                          contact={contact}
                          actions={
                            <RowToolbar
                              reorder={controls}
                              actions={
                                <RowActions
                                  label={contact.name}
                                  busy={saving() === "contact"}
                                  onEdit={() =>
                                    setEditing({ kind: "contact", contact })
                                  }
                                  onDelete={() =>
                                    setRemoving({
                                      kind: "contact",
                                      id: contact.id,
                                      label: contact.name,
                                    })
                                  }
                                />
                              }
                            />
                          }
                        />
                      )}
                    </ReorderableList>
                  </Match>
                </Switch>
              </Tabs.Content>
            </Tabs.Root>
          </Match>
        </Switch>

        <Show when={isOwner()}>
          <section
            aria-labelledby="portfolio-help"
            class={cn(sectionClass, "flex flex-col gap-3")}
          >
            <SectionHeading
              id="portfolio-help"
              title="Where this shows up"
              lead="Nothing here is a draft — every save is live on your public profile straight away."
            />
            <Show when={profileHref(business())}>
              {(href) => (
                <p class="text-sm text-text-muted">
                  Partners browsing{" "}
                  <A
                    href="/marketplace"
                    class="font-medium text-primary underline underline-offset-4"
                  >
                    the marketplace
                  </A>{" "}
                  land on{" "}
                  <A
                    href={href()}
                    class="font-mono text-primary underline underline-offset-4"
                  >
                    {href()}
                  </A>
                  , where these three sections appear in the order you set here.
                </p>
              )}
            </Show>
          </section>
        </Show>
      </div>

      {/* Editors. The API re-checks ownership on every call. */}
      <Show when={isOwner() && editing()}>
        {(open) => (
          <Switch>
            <Match when={open().kind === "profile" && business()}>
              {(mine) => (
                <ProfileDialog
                  profile={asProfile(mine())}
                  onClose={() => setEditing(null)}
                  onSave={(draft: ProfileDraft) =>
                    saveProfileDetails(mine(), draft)
                  }
                  onSaved={() =>
                    done("Business details saved.", refetchBusiness)
                  }
                />
              )}
            </Match>

            <Match when={open().kind === "service"}>
              <ServiceDialog
                service={(open() as { service?: CompanyService }).service}
                onClose={() => setEditing(null)}
                onSave={(draft: ServiceDraft) => {
                  const existing = (open() as { service?: CompanyService })
                    .service;
                  return existing
                    ? updateService(businessId()!, existing.id, draft)
                    : createService(
                        businessId()!,
                        draft,
                        nextPosition(serviceList()),
                      );
                }}
                onSaved={() => done("Services updated.", refetchServices)}
              />
            </Match>

            <Match when={open().kind === "project"}>
              <ProjectDialog
                project={(open() as { project?: CompanyProject }).project}
                onClose={() => setEditing(null)}
                onSave={(draft: ProjectDraft) => {
                  const existing = (open() as { project?: CompanyProject })
                    .project;
                  return existing
                    ? updateProject(businessId()!, existing.id, draft)
                    : createProject(
                        businessId()!,
                        draft,
                        nextPosition(projectList()),
                      );
                }}
                onSaved={() => done("Projects updated.", refetchProjects)}
              />
            </Match>

            <Match when={open().kind === "contact"}>
              <ContactDialog
                contact={(open() as { contact?: CompanyContact }).contact}
                onClose={() => setEditing(null)}
                onSave={(draft: ContactDraft) => {
                  const existing = (open() as { contact?: CompanyContact })
                    .contact;
                  return existing
                    ? updateContact(businessId()!, existing.id, draft)
                    : createContact(
                        businessId()!,
                        draft,
                        nextPosition(contactList()),
                      );
                }}
                onSaved={() => done("Contacts updated.", refetchContacts)}
              />
            </Match>
          </Switch>
        )}
      </Show>

      <ConfirmDialog
        open={Boolean(removing())}
        title={`Remove ${removing()?.label ?? "this item"}?`}
        description="It disappears from your public profile straight away. This can't be undone."
        confirmLabel="Remove"
        pending={removePending()}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

/** Which editor is open. An absent row means "add". */
type Editing =
  | { kind: "profile" }
  | { kind: "service"; service?: CompanyService }
  | { kind: "project"; project?: CompanyProject }
  | { kind: "contact"; contact?: CompanyContact };

type Removing = { kind: PortfolioKind; id: string; label: string };

/**
 * The shell already holds the business, so the details dialog is seeded from
 * that rather than re-fetching the same row through the partner endpoint.
 */
function asProfile(business: BusinessInfo): CompanyProfile {
  return {
    id: business.businessId,
    name: business.businessName,
    username: business.username || null,
    logo: business.logo,
    description: business.description || null,
    sector: business.sector || null,
    rating: business.rating,
    reviewCount: business.reviewCount,
    address: business.address || null,
    phone: business.phone || null,
  };
}
