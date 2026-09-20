import { query } from "@solidjs/router";
import type { AnalyticsData } from "~/types/analytics";

/** Campaign analytics for the signed-in owner, loaded on the server. */
export const getCampaignAnalytics = query(async (): Promise<AnalyticsData> => {
  "use server";
  const { requireSession } = await import("~/server/session");
  const { loadCampaignAnalytics } = await import("~/server/analytics-data");

  const session = await requireSession();
  return loadCampaignAnalytics(session.user.id);
}, "campaign-analytics");
