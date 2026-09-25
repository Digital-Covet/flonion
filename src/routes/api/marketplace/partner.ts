import { Effect } from "effect";
import { getCompanyProfile } from "~/lib/company-profile";
import { BadRequest, RawResponse, UpstreamError } from "~/server/effect/errors";
import { recoverAll } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";

export const GET = handler(
  "marketplace.partner",
  Effect.gen(function* () {
    const { url } = yield* RequestContext;
    const identifier = url.searchParams.get("username")?.trim();
    if (!identifier) {
      return yield* new BadRequest({
        message: "username query parameter is required",
      });
    }

    const partner = yield* getCompanyProfile(identifier).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[marketplace/partner] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load partner" }),
      ),
    );

    if (!partner) {
      return yield* new RawResponse({
        response: Response.json({ partner: null }, { status: 404 }),
      });
    }
    return { partner };
  }),
);
