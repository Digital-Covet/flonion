import { Effect, Option, Schema } from "effect";
import { BadRequest, RawResponse, UpstreamError } from "~/server/effect/errors";
import {
  catchAll,
  decodeSearchParams,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Google, request } from "~/server/effect/services/google";
import type { GoogleReview, GoogleReviewsResponse } from "~/types/google";

const notAuthenticated = () =>
  new RawResponse({
    response: Response.json(
      { error: "Not authenticated", authUrl: "/api/google/auth" },
      { status: 401 },
    ),
  });

const Query = Schema.Struct({
  accountId: Schema.NonEmptyString,
  locationId: Schema.NonEmptyString,
  pageToken: Schema.optionalKey(Schema.String),
  pageSize: Schema.optionalKey(Schema.String),
});

const fetchReviews = Effect.fn("google.reviews.fetch")(function* (
  userId: string,
  query: typeof Query.Type,
) {
  const google = yield* Google;
  const accessToken = yield* google.accessToken(userId);

  const parent = `accounts/${query.accountId}/locations/${query.locationId}`;
  const params = new URLSearchParams({ pageSize: query.pageSize || "50" });
  if (query.pageToken) params.set("pageToken", query.pageToken);

  const response = yield* request(
    `https://mybusiness.googleapis.com/v4/${parent}/reviews?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { retry: true },
  );

  if (!response.ok) {
    const errorData = yield* Effect.promise(() =>
      response.json().catch(() => ({})),
    );
    return Response.json(
      {
        error: "Failed to fetch reviews",
        details: errorData.error?.message || response.statusText,
      },
      { status: response.status },
    );
  }

  const data: {
    reviews?: GoogleReview[];
    averageRating?: number;
    totalReviewCount?: number;
    nextPageToken?: string;
  } = yield* Effect.promise(() => response.json());

  const body: GoogleReviewsResponse = {
    reviews: data.reviews || [],
    averageRating: data.averageRating || 0,
    totalReviewCount: data.totalReviewCount || 0,
    nextPageToken: data.nextPageToken,
  };
  return Response.json(body);
});

export const GET = handler(
  "google.reviews",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const google = yield* Google;

    if (!(yield* google.isConnected(session.user.id))) {
      return yield* notAuthenticated();
    }

    const query = yield* decodeSearchParams(
      Query,
      () =>
        new BadRequest({
          message: "Missing required parameters: accountId and locationId",
        }),
    );

    return yield* fetchReviews(session.user.id, query).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[google/reviews] request failed:", cause),
        ),
      ),
      catchAll((error) =>
        Effect.fail(
          Option.isSome(error) && error.value._tag === "GoogleAuthRequired"
            ? notAuthenticated()
            : new UpstreamError({
                status: 500,
                message: "Failed to fetch reviews",
              }),
        ),
      ),
    );
  }),
);
