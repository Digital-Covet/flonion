import { Effect, Schema } from "effect";
import { BadRequest, NotFound, UpstreamError } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverAll,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const logFailure =
  (label: string) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error(`[marketplace/favorites] ${label} failed:`, cause),
        ),
      ),
    );

export const GET = handler(
  "marketplace.favorites.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;
    const favorites = yield* db
      .use((p) =>
        p.favoritePartner.findMany({
          where: { userId: session.user.id },
          select: { businessId: true },
        }),
      )
      .pipe(
        logFailure("GET"),
        recoverAll(
          new UpstreamError({
            status: 500,
            message: "Failed to load favorites",
          }),
        ),
      );
    return { favorites: favorites.map((f) => f.businessId) };
  }),
);

/** Toggles `businessId` in the caller's favourites. */
export const POST = handler(
  "marketplace.favorites.toggle",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    const { businessId } = body;
    if (!Schema.is(Schema.NonEmptyString)(businessId)) {
      return yield* new BadRequest({ message: "businessId is required" });
    }

    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      }),
    );
    if (!business) {
      return yield* new NotFound({ message: "Business not found" });
    }

    const existing = yield* db.use((p) =>
      p.favoritePartner.findUnique({
        where: { userId_businessId: { userId: session.user.id, businessId } },
      }),
    );
    if (existing) {
      yield* db.use((p) =>
        p.favoritePartner.delete({ where: { id: existing.id } }),
      );
      return { favorited: false };
    }

    yield* db.use((p) =>
      p.favoritePartner.create({
        data: { userId: session.user.id, businessId },
      }),
    );
    return { favorited: true };
  }).pipe(
    recoverUnexpected(
      new UpstreamError({ status: 500, message: "Failed to update favorite" }),
      "[marketplace/favorites] POST failed:",
    ),
  ),
);
