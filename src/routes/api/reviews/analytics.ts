import { Effect } from "effect";
import { loadCampaignAnalytics } from "~/server/analytics-data";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";

/**
 * Kept for any client that still fetches this directly; the analytics page
 * reads the same data through `getCampaignAnalytics()`. Both share
 * `loadCampaignAnalytics` so the two responses cannot drift.
 */
export const GET = handler(
  "reviews.analytics",
  Effect.gen(function* () {
    const session = yield* requireSession();
    return yield* loadCampaignAnalytics(session.session.userId);
  }),
);
