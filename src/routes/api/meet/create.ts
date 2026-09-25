import { Effect, Option } from "effect";
import { UpstreamError } from "~/server/effect/errors";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Google } from "~/server/effect/services/google";

export const GET = handler(
  "meet.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const google = yield* Google;
    const link = yield* google.createMeetLink(session.user.id);

    if (Option.isNone(link)) {
      return yield* new UpstreamError({
        status: 502,
        message:
          "Failed to create Google Meet link. Ensure your Google account is connected with Meet permissions.",
      });
    }
    return { meetUri: link.value.meetUri };
  }),
);
