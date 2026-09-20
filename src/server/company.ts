import { query } from "@solidjs/router";
import type {
  CompanyContact,
  CompanyProfile,
  CompanyProject,
  CompanyService,
} from "~/lib/company-profile";

export type CompanyPage = {
  profile: CompanyProfile;
  services: CompanyService[];
  projects: CompanyProject[];
  contacts: CompanyContact[];
};

/**
 * Everything `/company/:username` shows, in one call.
 *
 * The page used to fetch the profile, wait for it, then fetch services,
 * projects and contacts with the id it returned — three levels deep, each hop
 * a separate browser round-trip on top of `/api/business`. Only the id
 * dependency is real, so the three fan out in parallel here and the client
 * makes one request instead of five.
 *
 * `null` means no business is published at that handle; the page renders an
 * empty state for it rather than an error.
 */
export const getCompanyPage = query(
  async (identifier: string): Promise<CompanyPage | null> => {
    "use server";
    const { requireSession } = await import("~/server/session");
    await requireSession();

    const {
      getCompanyContacts,
      getCompanyProfile,
      getCompanyProjects,
      getCompanyServices,
    } = await import("~/lib/company-profile");

    const profile = await getCompanyProfile(identifier);
    if (!profile) return null;

    const [services, projects, contacts] = await Promise.all([
      getCompanyServices(profile.id),
      getCompanyProjects(profile.id),
      getCompanyContacts(profile.id),
    ]);

    return { profile, services, projects, contacts };
  },
  "company-page",
);
