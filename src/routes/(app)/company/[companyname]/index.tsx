import { For, Show, createResource } from "solid-js";
import { useParams } from "@solidjs/router";
import {
  GlassCard,
  SectionHeading,
  StarRating,
  StatTile,
  ServiceTile,
  FeaturedProjectTile,
  ContactRow,
  HeroSection,
  FeaturedBanner,
  Scheduler,
} from "~/components/marketplace/portfolio";

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

async function fetchBusiness(username: string): Promise<BusinessData | null> {
  try {
    const res = await fetch(`/api/marketplace/partner?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.partner ?? null;
  } catch {
    return null;
  }
}

async function fetchServices(businessId: string): Promise<ServiceData[]> {
  try {
    const res = await fetch(`/api/marketplace/services?businessId=${businessId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.services) ? data.services : [];
  } catch {
    return [];
  }
}

async function fetchProjects(businessId: string): Promise<ProjectData[]> {
  try {
    const res = await fetch(`/api/marketplace/projects?businessId=${businessId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

async function fetchContacts(businessId: string): Promise<ContactData[]> {
  try {
    const res = await fetch(`/api/marketplace/contacts?businessId=${businessId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.contacts) ? data.contacts : [];
  } catch {
    return [];
  }
}

export const StudioProfile = () => {
  const params = useParams();
  const companyname = () => params.companyname ?? "";
  const [business] = createResource(companyname, fetchBusiness);
  const [services] = createResource(() => business()?.id, fetchServices);
  const [projects] = createResource(() => business()?.id, fetchProjects);
  const [contacts] = createResource(() => business()?.id, fetchContacts);

  return (
    <main class="flex-1 w-full max-w-360 mx-auto p-4 md:p-8 flex flex-col gap-6">
      <Show
        when={!RESERVED_ROUTES.has(companyname()) && business()}
        fallback={
          <div class="flex flex-col items-center justify-center py-24 text-center">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <span class="text-2xl font-bold text-muted-foreground">?</span>
            </div>
            <h3 class="mb-2 font-heading text-xl font-bold text-foreground">
              Profile not found
            </h3>
            <p class="mb-6 max-w-xs text-sm text-muted-foreground">
              The studio you're looking for doesn't exist or isn't available yet.
            </p>
          </div>
        }
      >
        <HeroSection
          name={business()!.name}
          logo={business()!.logo}
          description={business()!.description}
          address={business()!.address}
          sector={business()!.sector}
        />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div class="lg:col-span-2 flex flex-col gap-4 lg:gap-6">
            <GlassCard>
              <SectionHeading class="mb-4">About the Studio</SectionHeading>
              <p class="text-base text-muted-foreground leading-relaxed">
                {business()!.description ?? "No description available."}
              </p>
            </GlassCard>

            <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Show
                when={services() && services()!.length > 0}
                fallback={
                  <>
                    <ServiceTile
                      icon="box"
                      title="No Services Listed"
                      description="This studio hasn't added services yet."
                    />
                  </>
                }
              >
                <For each={services()}>
                  {(s) => (
                    <ServiceTile
                      icon={s.icon as any}
                      title={s.title}
                      description={s.description}
                    />
                  )}
                </For>
              </Show>
              <FeaturedBanner />
            </section>

            <GlassCard>
              <div class="flex justify-between items-center mb-5">
                <SectionHeading>Featured Projects</SectionHeading>
              </div>
              <Show
                when={projects() && projects()!.length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    No projects have been added yet.
                  </p>
                }
              >
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <For each={projects()}>
                    {(p, i) => (
                      <div class={i() === 2 ? "hidden md:block" : ""}>
                        <FeaturedProjectTile src={p.imageUrl} alt={p.altText} />
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </GlassCard>
          </div>

          <div class="flex flex-col gap-4 lg:gap-6">
            <section class="grid grid-cols-2 gap-4">
              <StatTile
                value={business()!.rating?.toFixed(1) ?? "0.0"}
                label={`${business()!.reviewCount ?? 0} Reviews`}
              >
                <StarRating value={business()!.rating ?? 0} />
              </StatTile>
              <StatTile
                value={`${services()?.length ?? 0}`}
                label="Services Offered"
              />
            </section>

            <Scheduler businessId={business()!.id} />

            <GlassCard>
              <SectionHeading class="mb-5">Key Contacts</SectionHeading>
              <Show
                when={contacts() && contacts()!.length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    No contacts have been added yet.
                  </p>
                }
              >
                <div class="flex flex-col gap-4">
                  <For each={contacts()}>
                    {(c) => (
                      <ContactRow
                        name={c.name}
                        role={c.role}
                        avatar={c.avatarUrl ?? ""}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </GlassCard>
          </div>
        </div>
      </Show>
    </main>
  );
};

export default StudioProfile;
