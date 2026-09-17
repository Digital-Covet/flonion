import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import Briefcase from "lucide-solid/icons/briefcase";
import CalendarCheck from "lucide-solid/icons/calendar-check";
import Heart from "lucide-solid/icons/heart";
import Inbox from "lucide-solid/icons/inbox";
import Mail from "lucide-solid/icons/mail";
import MapPin from "lucide-solid/icons/map-pin";
import Star from "lucide-solid/icons/star";
import { createResource, createSignal, For, Show } from "solid-js";
import {
  iconMap,
  toIconName,
} from "~/components/marketplace/portfolio/icon-map";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton, SkeletonRows, WidgetError } from "~/components/ui/skeleton";
import { AppToaster, notify } from "~/components/ui/toast";

const RESERVED_ROUTES = new Set([
  "dashboard",
  "account",
  "settings",
  "reviews",
  "marketplace",
  "marketing",
  "feedback",
  "auth",
  "onboarding",
  "accept-invite",
  "review",
]);

interface BusinessData {
  id: string;
  name: string;
  username: string | null;
  logo: string | null;
  description: string | null;
  sector: string | null;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  phone: string | null;
}

interface ServiceData {
  id: string;
  icon: string;
  title: string;
  description: string;
  position: number;
}

interface ProjectData {
  id: string;
  imageUrl: string;
  altText: string;
  position: number;
}

interface ContactData {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  email: string | null;
  position: number;
}

// SSR-safe reads: relative fetch has no origin on the server, so hit the DB
// directly during SSR (Prisma is dead-code eliminated from the browser bundle
// via the SSR literal fold).
async function fetchBusiness(username: string): Promise<BusinessData | null> {
  try {
    if (import.meta.env.SSR) {
      const { getCompanyProfile } = await import("~/lib/company-profile");
      return await getCompanyProfile(username);
    }
    const res = await fetch(
      `/api/marketplace/partner?username=${encodeURIComponent(username)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.partner ?? null;
  } catch (err) {
    console.error("[company] business lookup failed:", err);
    return null;
  }
}

async function fetchServices(businessId: string): Promise<ServiceData[]> {
  try {
    if (import.meta.env.SSR) {
      const { getCompanyServices } = await import("~/lib/company-profile");
      return await getCompanyServices(businessId);
    }
    const res = await fetch(
      `/api/marketplace/services?businessId=${businessId}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.services) ? data.services : [];
  } catch (err) {
    console.error("[company] services lookup failed:", err);
    return [];
  }
}

async function fetchProjects(businessId: string): Promise<ProjectData[]> {
  try {
    if (import.meta.env.SSR) {
      const { getCompanyProjects } = await import("~/lib/company-profile");
      return await getCompanyProjects(businessId);
    }
    const res = await fetch(
      `/api/marketplace/projects?businessId=${businessId}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : [];
  } catch (err) {
    console.error("[company] projects lookup failed:", err);
    return [];
  }
}

async function fetchContacts(businessId: string): Promise<ContactData[]> {
  try {
    if (import.meta.env.SSR) {
      const { getCompanyContacts } = await import("~/lib/company-profile");
      return await getCompanyContacts(businessId);
    }
    const res = await fetch(
      `/api/marketplace/contacts?businessId=${businessId}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.contacts) ? data.contacts : [];
  } catch (err) {
    console.error("[company] contacts lookup failed:", err);
    return [];
  }
}

function RatingStars(props: { value: number }) {
  const full = () => Math.round(props.value);
  return (
    <span
      class="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${props.value.toFixed(1)} out of 5`}
    >
      <For each={[1, 2, 3, 4, 5]}>
        {(i) => (
          <Star
            class="size-4 text-star"
            fill={i <= full() ? "currentColor" : "none"}
            aria-hidden="true"
          />
        )}
      </For>
    </span>
  );
}

export const StudioProfile = () => {
  const params = useParams();
  const companyname = () => params.companyname ?? "";
  const [business, { refetch: refetchBusiness }] = createResource(
    companyname,
    fetchBusiness,
  );
  const [services] = createResource(() => business()?.id, fetchServices);
  const [projects] = createResource(() => business()?.id, fetchProjects);
  const [contacts] = createResource(() => business()?.id, fetchContacts);

  const [saved, setSaved] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  const saveProfile = async () => {
    const id = business()?.id;
    if (!id || saving()) return;
    // Favourite toggle: un-favourite is the same endpoint (toggle semantics).
    if (saved()) {
      setSaved(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/marketplace/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (res.status === 401) {
        window.location.href = `/login?callbackURL=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
      notify("success", "Profile saved to favorites");
    } catch {
      notify("error", "Couldn't save profile", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isReserved = () => RESERVED_ROUTES.has(companyname());
  const bookingHref = () =>
    business()?.username ? `/company/${business()!.username}/bookings` : null;
  const reviewHref = () =>
    business()?.username ? `/company/${business()!.username}/review` : null;

  return (
    <>
      <Title>
        {business()
          ? `${business()!.name} — Company profile`
          : "Company profile"}
      </Title>
      <Meta
        name="description"
        content={
          business()?.description ??
          "View services, projects, and contacts for this business, and book a meeting."
        }
      />
      <AppToaster />

      {/* DS §6 Company Profile: hero → stats → services → projects gallery →
          contacts → sticky "Book a meeting". Single column, stacked sections. */}
      <main class="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:gap-6 md:p-8">
        <Show when={business.loading}>
          <div
            class="rounded-card border border-border bg-card p-6 shadow-sm"
            aria-hidden="true"
          >
            <div class="flex flex-col gap-4 md:flex-row">
              <Skeleton class="h-24 w-24 rounded-card md:h-28 md:w-28" />
              <div class="grid flex-1 gap-2">
                <Skeleton class="h-8 w-1/2" />
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-4 w-1/3" />
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Skeleton class="h-24 w-full" />
            <Skeleton class="h-24 w-full" />
            <Skeleton class="hidden h-24 w-full md:block" />
          </div>
          <SkeletonRows count={3} />
        </Show>

        <Show when={business.error}>
          <WidgetError
            message="Could not load this profile."
            onRetry={() => refetchBusiness()}
            retryLabel="Retry"
          />
        </Show>

        <Show
          when={
            !business.loading &&
            !business.error &&
            (isReserved() || !business())
          }
        >
          <EmptyState
            icon={Inbox}
            title="Profile not found"
            description="The studio you're looking for doesn't exist or isn't available yet."
            primaryLabel="Browse partners"
            primaryHref="/marketplace"
          />
        </Show>

        <Show when={!isReserved() && business()}>
          {/* Hero */}
          <section
            aria-labelledby="company-name"
            class="e1-enter rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <div class="flex flex-col gap-5 md:flex-row md:items-start">
              <Show
                when={business()!.logo}
                fallback={
                  <div
                    class="grid size-24 shrink-0 place-items-center rounded-card bg-muted font-heading text-4xl font-semibold text-muted-foreground md:size-28"
                    aria-hidden="true"
                  >
                    {business()!.name.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={business()!.logo!}
                  alt={`${business()!.name} logo`}
                  class="size-24 shrink-0 rounded-card border border-border object-cover md:size-28"
                />
              </Show>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h1
                    id="company-name"
                    class="font-heading text-2xl font-semibold text-foreground md:text-3xl"
                  >
                    {business()!.name}
                  </h1>
                  <span class="inline-flex items-center gap-1 rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success">
                    Verified
                  </span>
                </div>
                <p class="mt-2 text-base leading-relaxed text-muted-foreground">
                  {business()!.description ?? "No description available."}
                </p>
                <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  <Show when={business()!.address}>
                    <span class="inline-flex items-center gap-1.5">
                      <MapPin class="size-4 shrink-0" aria-hidden="true" />
                      {business()!.address}
                    </span>
                  </Show>
                  <Show when={business()!.sector}>
                    <span class="inline-flex items-center gap-1.5">
                      <Briefcase class="size-4 shrink-0" aria-hidden="true" />
                      {business()!.sector}
                    </span>
                  </Show>
                </div>
              </div>

              <div class="flex flex-col gap-2 md:w-52 md:shrink-0">
                <Show when={bookingHref()}>
                  <a
                    href={bookingHref()!}
                    class="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                  >
                    <CalendarCheck class="size-4" aria-hidden="true" />
                    Book a meeting
                  </a>
                </Show>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving()}
                  aria-pressed={saved()}
                  aria-label={
                    saved() ? "Remove from favorites" : "Save to favorites"
                  }
                  class="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <Heart
                    class="size-4"
                    fill={saved() ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                  {saving() ? "Saving…" : saved() ? "Saved" : "Save profile"}
                </button>
                <Show when={reviewHref()}>
                  <a
                    href={reviewHref()!}
                    class="inline-flex h-11 items-center justify-center gap-1.5 rounded-control px-5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Star class="size-4" aria-hidden="true" />
                    Leave a review
                  </a>
                </Show>
              </div>
            </div>
          </section>

          {/* Stats — number always next to stars (DS §2). */}
          <section
            aria-label="Profile stats"
            class="grid grid-cols-2 gap-4 md:grid-cols-3"
          >
            <div class="rounded-card border border-border bg-card p-5 shadow-sm">
              <p class="flex items-center gap-2">
                <span class="tnum font-heading text-2xl font-semibold text-foreground">
                  {(business()!.rating ?? 0).toFixed(1)}
                </span>
                <Star
                  class="size-5 text-star"
                  fill="currentColor"
                  aria-hidden="true"
                />
              </p>
              <div class="mt-1.5">
                <RatingStars value={business()!.rating ?? 0} />
              </div>
              <p class="tnum mt-1.5 text-sm text-muted-foreground">
                {business()!.reviewCount ?? 0}{" "}
                {(business()!.reviewCount ?? 0) === 1 ? "review" : "reviews"}
              </p>
            </div>
            <div class="rounded-card border border-border bg-card p-5 shadow-sm">
              <p class="tnum font-heading text-2xl font-semibold text-foreground">
                {services()?.length ?? 0}
              </p>
              <p class="mt-1.5 text-sm text-muted-foreground">
                Services offered
              </p>
            </div>
            <div class="col-span-2 rounded-card border border-border bg-card p-5 shadow-sm md:col-span-1">
              <p class="tnum font-heading text-2xl font-semibold text-foreground">
                {projects()?.length ?? 0}
              </p>
              <p class="mt-1.5 text-sm text-muted-foreground">
                Projects showcased
              </p>
            </div>
          </section>

          {/* Services */}
          <section
            aria-labelledby="company-services"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="company-services"
              class="font-heading text-xl font-semibold text-foreground"
            >
              Services
            </h2>
            <Show
              when={!services.loading}
              fallback={
                <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Skeleton class="h-32 w-full" />
                  <Skeleton class="h-32 w-full" />
                </div>
              }
            >
              <Show
                when={(services() ?? []).length > 0}
                fallback={
                  <p class="mt-3 text-sm text-muted-foreground">
                    This business hasn't listed any services yet.
                  </p>
                }
              >
                <ul class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <For each={services()}>
                    {(s) => {
                      const Icon = iconMap[toIconName(s.icon)];
                      return (
                        <li class="rounded-card border border-border bg-background p-5 transition-colors hover:border-primary/60">
                          <span class="text-primary">
                            <Icon class="size-8" />
                          </span>
                          <h3 class="mt-3 text-lg font-medium text-foreground">
                            {s.title}
                          </h3>
                          <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {s.description}
                          </p>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>

          {/* Projects gallery */}
          <section
            aria-labelledby="company-projects"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="company-projects"
              class="font-heading text-xl font-semibold text-foreground"
            >
              Projects
            </h2>
            <Show
              when={!projects.loading}
              fallback={
                <div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Skeleton class="aspect-square w-full" />
                  <Skeleton class="aspect-square w-full" />
                  <Skeleton class="hidden aspect-square w-full md:block" />
                </div>
              }
            >
              <Show
                when={(projects() ?? []).length > 0}
                fallback={
                  <p class="mt-3 text-sm text-muted-foreground">
                    No projects have been added yet.
                  </p>
                }
              >
                <ul class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                  <For each={projects()}>
                    {(p) => (
                      <li class="overflow-hidden rounded-card border border-border bg-background">
                        <img
                          src={p.imageUrl}
                          alt={p.altText || "Project image"}
                          loading="lazy"
                          class="aspect-square w-full object-cover"
                        />
                        <Show when={p.altText}>
                          <p class="truncate px-3 py-2 text-xs text-muted-foreground">
                            {p.altText}
                          </p>
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>

          {/* Contacts */}
          <section
            aria-labelledby="company-contacts"
            class="rounded-card border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="company-contacts"
              class="font-heading text-xl font-semibold text-foreground"
            >
              Contacts
            </h2>
            <Show
              when={!contacts.loading}
              fallback={
                <div class="mt-4">
                  <SkeletonRows count={2} />
                </div>
              }
            >
              <Show
                when={(contacts() ?? []).length > 0}
                fallback={
                  <p class="mt-3 text-sm text-muted-foreground">
                    No contacts have been added yet.
                  </p>
                }
              >
                <ul class="mt-2 divide-y divide-border">
                  <For each={contacts()}>
                    {(c) => (
                      <li class="flex items-center gap-4 py-4">
                        <Show
                          when={c.avatarUrl}
                          fallback={
                            <div
                              class="grid size-12 shrink-0 place-items-center rounded-full bg-muted font-heading text-lg font-semibold text-muted-foreground"
                              aria-hidden="true"
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          }
                        >
                          <img
                            src={c.avatarUrl!}
                            alt=""
                            loading="lazy"
                            class="size-12 shrink-0 rounded-full object-cover"
                          />
                        </Show>
                        <div class="min-w-0">
                          <h3 class="truncate text-sm font-medium text-foreground">
                            {c.name}
                          </h3>
                          <p class="truncate text-sm text-muted-foreground">
                            {c.role}
                          </p>
                        </div>
                        <Show when={c.email}>
                          <a
                            href={`mailto:${c.email}`}
                            aria-label={`Email ${c.name}`}
                            class="ml-auto grid size-11 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10"
                          >
                            <Mail class="size-5" aria-hidden="true" />
                          </a>
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>

          {/* Sticky "Book a meeting" (DS §6) — always reachable. */}
          <Show when={bookingHref()}>
            <div class="sticky bottom-4 z-10 md:bottom-6">
              <a
                href={bookingHref()!}
                class="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-hover"
              >
                <CalendarCheck class="size-5" aria-hidden="true" />
                Book a meeting with {business()!.name}
              </a>
            </div>
          </Show>
        </Show>
      </main>
    </>
  );
};

export default StudioProfile;
