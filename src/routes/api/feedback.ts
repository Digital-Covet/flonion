import { Effect, Schema } from "effect";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_EMAIL_MAX,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_NAME_MAX,
} from "~/lib/feedback";
import { BadRequest } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const Category = Schema.Literals(FEEDBACK_CATEGORIES);
const Rating = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
);

/** Required text, trimmed, with the form's own "required"/"too long" messages. */
function requiredText(
  value: unknown,
  label: string,
  max: number,
): Effect.Effect<string, BadRequest> {
  if (typeof value !== "string" || !value.trim()) {
    return Effect.fail(new BadRequest({ message: `${label} is required` }));
  }
  const trimmed = value.trim();
  // `maxlength` on the form is a hint to a browser, not a constraint on a
  // request, so the ceiling is enforced here too.
  return trimmed.length > max
    ? Effect.fail(new BadRequest({ message: `${label} is too long` }))
    : Effect.succeed(trimmed);
}

export const POST = handler(
  "feedback.create",
  Effect.gen(function* () {
    const session = yield* requireSession();

    return yield* Effect.gen(function* () {
      const body = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );

      const name = yield* requiredText(body.name, "Name", FEEDBACK_NAME_MAX);
      const email = yield* requiredText(
        body.email,
        "Email",
        FEEDBACK_EMAIL_MAX,
      );

      if (!Schema.is(Category)(body.category)) {
        return yield* new BadRequest({ message: "Valid category is required" });
      }
      const category = body.category;

      const rating = Number(body.rating);
      if (!Schema.is(Rating)(rating)) {
        return yield* new BadRequest({
          message: "Rating must be an integer between 1 and 5",
        });
      }

      const message = yield* requiredText(
        body.message,
        "Message",
        FEEDBACK_MESSAGE_MAX,
      );

      const db = yield* Db;
      const feedback = yield* db.use((p) =>
        p.feedback.create({
          data: {
            userId: session.user.id,
            name,
            email,
            category,
            rating,
            message,
          },
        }),
      );
      return { id: feedback.id, success: true };
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
