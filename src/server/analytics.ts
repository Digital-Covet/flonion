import { query } from "@solidjs/router";
import type { AnalyticsData } from "~/types/analytics";

/** Campaign analytics for the signed-in owner, loaded on the server. */
export const getCampaignAnalytics = query(async (): Promise<AnalyticsData> => {
  "use server";
  const { loadCampaignAnalyticsForSession } = await import(
    "~/server/analytics-data"
  );
  return loadCampaignAnalyticsForSession();
}, "campaign-analytics");
