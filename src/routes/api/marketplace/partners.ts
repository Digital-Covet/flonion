import { Effect } from "effect";
import { getPartners, parsePartnersQuery } from "~/lib/partners-query";
import { UpstreamError } from "~/server/effect/errors";
import { recoverAll } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";

export type { Partner } from "~/lib/partners-query";

export const GET = handler(
  "marketplace.partners",
  Effect.gen(function* () {
    const { url } = yield* RequestContext;
    const { payload, cached } = yield* getPartners(
      parsePartnersQuery(url),
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[marketplace/partners] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load partners" }),
      ),
    );

    return Response.json(payload, {
      headers: {
        // `private`, not `public`: this path is not in the middleware's
        // PUBLIC_PREFIXES, so an anonymous caller gets a 401. Marking the 200
        // `public` invites a shared cache to store it and hand it to exactly
        // that caller. The route's own header wins over the middleware's
        // `no-store` guard, so it has to be right here.
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        "X-Cache": cached ? "HIT" : "MISS",
      },
    });
  }),
);
