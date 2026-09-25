import { query } from "@solidjs/router";
import type { BusinessInfo } from "~/types/business";

/**
 * The business behind the signed-in app shell. Server-loaded, so the business
 * name is in the first HTML rather than arriving two round-trips after hydrate.
 *
 * Revalidate with `getBusiness.key`, never the string literal.
 */
export const getBusiness = query(async (): Promise<BusinessInfo> => {
  "use server";
  const { loadBusinessInfoForSession } = await import("~/server/business-data");
  return loadBusinessInfoForSession();
}, "business");
