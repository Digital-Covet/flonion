import { Effect } from "effect";
import {
  getCompanyContacts,
  getCompanyProfile,
  getCompanyProjects,
  getCompanyServices,
} from "~/lib/company-profile";
import { requireSessionOrLogin } from "~/server/effect/guards";
import { runServerFn } from "~/server/effect/server-fn";
import type { CompanyPage } from "./company";

/** Server-only body of `getCompanyPage`. */
export function loadCompanyPage(
  identifier: string,
): Promise<CompanyPage | null> {
  return runServerFn(
    Effect.gen(function* () {
      yield* requireSessionOrLogin;

      const profile = yield* getCompanyProfile(identifier);
      if (!profile) return null;

      // Only the id dependency is real, so the rest fan out in parallel.
      const [services, projects, contacts] = yield* Effect.all(
        [
          getCompanyServices(profile.id),
          getCompanyProjects(profile.id),
          getCompanyContacts(profile.id),
        ],
        { concurrency: "unbounded" },
      );

      return { profile, services, projects, contacts };
    }),
  );
}
