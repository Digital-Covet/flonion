import type { BusinessInfo } from "~/components/app/context";
import type { SelectOption } from "~/components/onboarding/ui";
import { api } from "~/components/onboarding/ui";
import { httpUrl } from "~/lib/safe-url";

/**
 * Company profile state, reads and writes.
 *
 * The profile at `/company/:username` is both the public face of a business and
 * the owner's portfolio editor, so every read here has a matching write. The
 * API re-checks ownership on each mutation (`business.userId === session user`),
 * so the owner-only controls in the UI are an affordance, not the guard.
 */

export type CompanyProfile = {
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
};

export type CompanyService = {
  id: string;
  icon: string;
  title: string;
  description: string;
  position: number;
};

export type CompanyProject = {
  id: string;
  imageUrl: string;
  altText: string;
  position: number;
};

export type CompanyContact = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  email: string | null;
  position: number;
};

/** Icons the service editor offers, matching the names already in the table. */
export const SERVICE_ICON_OPTIONS: SelectOption[] = [
  { value: "box", label: "Box — general service" },
  { value: "sparkles", label: "Sparkles — creative" },
  { value: "globe", label: "Globe — web and online" },
  { value: "film", label: "Film — video and photo" },
  { value: "users", label: "Users — people and teams" },
  { value: "calendar", label: "Calendar — events" },
  { value: "location", label: "Pin — on-site work" },
  { value: "mail", label: "Mail — outreach" },
  { value: "star", label: "Star — premium" },
  { value: "check", label: "Check — done-for-you" },
  { value: "arrow-right", label: "Arrow — consulting" },
];

// ─── Reads ───────────────────────────────────────────────────────────────

/** `identifier` is a vanity username or, as a fallback, the business id. */
export async function loadProfile(
  identifier: string,
): Promise<CompanyProfile | null> {
  const res = await api<{ partner: CompanyProfile | null }>(
    `/api/marketplace/partner?username=${encodeURIComponent(identifier)}`,
  );
  // 404 is "no such business", not a failure: the page shows an empty state.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load this profile");
  return res.data.partner ?? null;
}

export async function loadServices(
  businessId: string,
): Promise<CompanyService[]> {
  const res = await api<{ services: CompanyService[] }>(
    `/api/marketplace/services?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load services");
  return res.data.services ?? [];
}

export async function loadProjects(
  businessId: string,
): Promise<CompanyProject[]> {
  const res = await api<{ projects: CompanyProject[] }>(
    `/api/marketplace/projects?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load work");
  return res.data.projects ?? [];
}

export async function loadContacts(
  businessId: string,
): Promise<CompanyContact[]> {
  const res = await api<{ contacts: CompanyContact[] }>(
    `/api/marketplace/contacts?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) throw new Error(res.data.error ?? "Failed to load contacts");
  return res.data.contacts ?? [];
}

// ─── Writes ──────────────────────────────────────────────────────────────

export type ServiceDraft = { icon: string; title: string; description: string };
export type ProjectDraft = { imageUrl: string; altText: string };
export type ContactDraft = {
  name: string;
  role: string;
  email: string;
  avatarUrl: string;
};

/** The whole profile header, as the edit dialog collects it. */
export type ProfileDraft = {
  businessName: string;
  description: string;
  sector: string;
  address: string;
  phone: string;
  logo: string;
};

function must(
  res: { ok: boolean; data: { error?: string } },
  fallback: string,
) {
  if (!res.ok) throw new Error(res.data.error ?? fallback);
}

/** The next free slot, so new rows land at the end of the section. */
export function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

export async function createService(
  businessId: string,
  draft: ServiceDraft,
  position: number,
) {
  must(
    await api("/api/marketplace/services", {
      method: "POST",
      body: { businessId, services: [{ ...draft, position }] },
    }),
    "Couldn't add that service",
  );
}

export async function updateService(
  businessId: string,
  id: string,
  draft: ServiceDraft,
) {
  must(
    await api("/api/marketplace/services", {
      method: "PATCH",
      body: { businessId, id, ...draft },
    }),
    "Couldn't save that service",
  );
}

export async function deleteService(businessId: string, id: string) {
  must(
    await api("/api/marketplace/services", {
      method: "DELETE",
      body: { businessId, id },
    }),
    "Couldn't remove that service",
  );
}

export async function createProject(
  businessId: string,
  draft: ProjectDraft,
  position: number,
) {
  must(
    await api("/api/marketplace/projects", {
      method: "POST",
      body: { businessId, projects: [{ ...draft, position }] },
    }),
    "Couldn't add that work",
  );
}

export async function updateProject(
  businessId: string,
  id: string,
  draft: ProjectDraft,
) {
  must(
    await api("/api/marketplace/projects", {
      method: "PATCH",
      body: { businessId, id, ...draft },
    }),
    "Couldn't save that work",
  );
}

export async function deleteProject(businessId: string, id: string) {
  must(
    await api("/api/marketplace/projects", {
      method: "DELETE",
      body: { businessId, id },
    }),
    "Couldn't remove that work",
  );
}

export async function createContact(
  businessId: string,
  draft: ContactDraft,
  position: number,
) {
  must(
    await api("/api/marketplace/contacts", {
      method: "POST",
      body: {
        businessId,
        contacts: [
          {
            name: draft.name,
            role: draft.role,
            email: draft.email || null,
            avatarUrl: draft.avatarUrl || null,
            position,
          },
        ],
      },
    }),
    "Couldn't add that contact",
  );
}

export async function updateContact(
  businessId: string,
  id: string,
  draft: ContactDraft,
) {
  must(
    await api("/api/marketplace/contacts", {
      method: "PATCH",
      body: {
        businessId,
        id,
        name: draft.name,
        role: draft.role,
        email: draft.email || null,
        avatarUrl: draft.avatarUrl || null,
      },
    }),
    "Couldn't save that contact",
  );
}

export async function deleteContact(businessId: string, id: string) {
  must(
    await api("/api/marketplace/contacts", {
      method: "DELETE",
      body: { businessId, id },
    }),
    "Couldn't remove that contact",
  );
}

/**
 * `POST /api/business` replaces the whole row, so the draft is merged over the
 * business the app shell already loaded. Posting only the edited fields would
 * blank the place id and review links the rest of the app runs on.
 */
export async function saveProfileDetails(
  business: BusinessInfo,
  draft: ProfileDraft,
): Promise<void> {
  must(
    await api("/api/business", {
      method: "POST",
      body: {
        placeId: business.placeId || null,
        reviewLink: business.reviewLink || null,
        reviewLinks: business.reviewLinks ?? {},
        keywords: business.keywords || null,
        username: business.username || null,
        businessName: draft.businessName.trim(),
        logo: draft.logo.trim() || null,
        description: draft.description.trim() || null,
        sector: draft.sector.trim() || null,
        address: draft.address.trim() || null,
        phone: draft.phone.trim() || null,
      },
    }),
    "Couldn't save your profile",
  );
}

/** Onboarding stores uploaded logos inline, so those are a legitimate value. */
export function isDataImage(value: string): boolean {
  return /^data:image\//i.test(value.trim());
}

/**
 * Images are rendered straight into `src`, and avatars and work shots are
 * pasted from wherever the owner hosts them, so only absolute http(s) URLs (or
 * an inline image the app itself stored) are let through.
 */
export function imageUrlError(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? "An image link is required." : null;
  if (isDataImage(trimmed)) return null;
  return httpUrl(trimmed) ? null : "Enter a full http(s) link to the image.";
}

// ─── Ordering ────────────────────────────────────────────────────────────

/** The three portfolio sections, each behind its own endpoint. */
export type PortfolioKind = "service" | "project" | "contact";

const ORDER_ENDPOINTS: Record<PortfolioKind, string> = {
  service: "/api/marketplace/services",
  project: "/api/marketplace/projects",
  contact: "/api/marketplace/contacts",
};

/** Pure move, shared by the drag handle and the up/down buttons. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Brings each row's stored position in line with where it now sits, so a
 * second move diffs against the truth rather than re-sending settled rows.
 *
 * Written in place on purpose. `For` keys rows by object identity, so handing
 * it fresh objects tears down every row — and with them the grip the owner is
 * still holding. `position` is never rendered, so writing it shows nothing.
 */
export function syncPositions(items: readonly { position: number }[]): void {
  items.forEach((item, index) => {
    item.position = index;
  });
}

/**
 * Saves a new order. Every section is read back `position` ascending, so the
 * new index *is* the new position. Only the rows that actually moved are sent,
 * which keeps nudging one row up to two requests instead of a rewrite of the
 * whole section.
 *
 * `ordered` carries each row's *old* position, so renumber only after this
 * resolves — a pre-renumbered list looks unchanged and saves nothing.
 */
export async function saveOrder(
  kind: PortfolioKind,
  businessId: string,
  ordered: readonly { id: string; position: number }[],
): Promise<void> {
  const moved = ordered
    .map((item, index) => ({
      id: item.id,
      position: index,
      was: item.position,
    }))
    .filter((row) => row.was !== row.position);

  if (moved.length === 0) return;

  const results = await Promise.all(
    moved.map(({ id, position }) =>
      api(ORDER_ENDPOINTS[kind], {
        method: "PATCH",
        body: { businessId, id, position },
      }),
    ),
  );

  // The rows go out together, so a failure can leave the section half-moved.
  // The caller refetches rather than reverting, so the UI shows what is stored.
  const failed = results.find((res) => !res.ok);
  if (failed) {
    throw new Error(failed.data.error ?? "Couldn't save the new order.");
  }
}
