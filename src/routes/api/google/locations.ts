import { Effect, Option } from "effect";
import { RawResponse, UpstreamError } from "~/server/effect/errors";
import { catchAll, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Google } from "~/server/effect/services/google";

const notAuthenticated = () =>
  new RawResponse({
    response: Response.json(
      { error: "Not authenticated", authUrl: "/api/google/auth" },
      { status: 401 },
    ),
  });

/**
 * Every account and its locations. One request for the account list plus one
 * per account, against a Business Profile quota there is very little of, so
 * `Google.locations` caches the walk per user.
 */
export const GET = handler(
  "google.locations",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const google = yield* Google;

    if (!(yield* google.isConnectedCached(session.user.id))) {
      return yield* notAuthenticated();
    }

    const accounts = yield* google.locations(session.user.id).pipe(
      catchAll((failure, cause) => {
        const error = Option.getOrUndefined(failure);

        if (error?._tag === "LocationsApiError") {
          return Effect.fail(
            new RawResponse({
              response: Response.json(error.body, { status: error.status }),
            }),
          );
        }

        console.error("[google/locations] request failed:", cause);

        // Only a dead grant warrants sending the owner back through OAuth. A
        // transient refresh failure must not be dressed up as "not connected".
        return Effect.fail(
          error?._tag === "GoogleAuthRequired"
            ? notAuthenticated()
            : new UpstreamError({
                status: 500,
                message: "Failed to fetch locations",
              }),
        );
      }),
    );

    return { accounts };
  }),
);
