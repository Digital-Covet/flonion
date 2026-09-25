import { Effect } from "effect";
import { NotFound, UpstreamError } from "~/server/effect/errors";
import {
  rateLimit,
  recoverAll,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Billing } from "~/server/effect/services/billing";
import { Db } from "~/server/effect/services/db";

const CANCEL_RATE_LIMIT = 5;
const CANCEL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Stops auto-renewal. The plan stays until the end of the period already
 * paid for (`Business.planExpiresAt`), so nothing is taken away early.
 */
export const POST = handler(
  "billing.cancel",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only the business owner or an admin can change the plan",
    );
    yield* rateLimit(
      `billing-cancel:${ctx.businessId}`,
      CANCEL_RATE_LIMIT,
      CANCEL_WINDOW_MS,
    );

    const db = yield* Db;
    const sub = yield* db.use((p) =>
      p.billingSubscription.findUnique({
        where: { liveBusinessId: ctx.businessId },
      }),
    );
    if (!sub) {
      return yield* new NotFound({
        message: "There's no active subscription to cancel",
      });
    }

    const billing = yield* Billing;
    const cancelled = yield* billing.cancel(sub).pipe(
      recoverAll(
        new UpstreamError({
          status: 502,
          message: "Couldn't cancel right now. Please try again.",
        }),
      ),
    );
    return { status: cancelled.status };
  }),
);
