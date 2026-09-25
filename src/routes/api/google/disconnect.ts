import { Effect } from "effect";
import { UpstreamError } from "~/server/effect/errors";
import { recoverAll, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Google } from "~/server/effect/services/google";

export const POST = handler(
  "google.disconnect",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const google = yield* Google;

    yield* google.clearTokens(session.user.id).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[google/disconnect] failed to clear tokens:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({
          status: 500,
          message: "Failed to disconnect Google account",
        }),
      ),
    );

    return {
      success: true,
      message: "Google account disconnected successfully",
    };
  }),
);

export const DELETE = POST;
