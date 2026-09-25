import { Effect, Schema } from "effect";
import { getCompanyServices } from "~/lib/company-profile";
import {
  MAX_BULK_ITEMS,
  MAX_LONG_FIELD,
  MAX_SHORT_FIELD,
} from "~/lib/input-limits";
import { BadRequest, UpstreamError } from "~/server/effect/errors";
import {
  checkFieldLimits,
  decodeJsonBody,
  readJsonObject,
  recoverAll,
  recoverUnexpected,
  requireItemRef,
  requireOwnedBusiness,
  requireQueryParam,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { bulk, Position, trimmedMax } from "~/server/effect/schemas";
import { Db } from "~/server/effect/services/db";

/**
 * Bounds the array and each field, and enforces at runtime the shape a type
 * assertion once only claimed. These rows are read back on every company
 * profile render.
 */
const CreateServices = Schema.Struct({
  businessId: Schema.NonEmptyString,
  services: bulk(
    Schema.Struct({
      icon: trimmedMax(MAX_SHORT_FIELD),
      title: trimmedMax(MAX_SHORT_FIELD),
      description: trimmedMax(MAX_LONG_FIELD),
      position: Schema.optional(Position),
    }),
  ),
});

const invalidBody = new BadRequest({ message: "Invalid request body" });

export const GET = handler(
  "marketplace.services.list",
  Effect.gen(function* () {
    const businessId = yield* requireQueryParam(
      "businessId",
      "businessId is required",
    );
    const services = yield* getCompanyServices(businessId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[marketplace/services] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load services" }),
      ),
    );
    return { services };
  }),
);

export const POST = handler(
  "marketplace.services.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { businessId, services } = yield* decodeJsonBody(
      CreateServices,
      () =>
        new BadRequest({
          message: `Between 1 and ${MAX_BULK_ITEMS} valid services are required`,
        }),
    );
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    const created = yield* db.use((p) =>
      p.service.createMany({
        data: services.map((s) => ({
          businessId,
          icon: s.icon,
          title: s.title,
          description: s.description,
          position: s.position ?? 0,
        })),
      }),
    );
    return { created: created.count };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const PATCH = handler(
  "marketplace.services.update",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);

    yield* checkFieldLimits([
      { label: "Icon", value: body.icon, max: MAX_SHORT_FIELD },
      { label: "Title", value: body.title, max: MAX_SHORT_FIELD },
      { label: "Description", value: body.description, max: MAX_LONG_FIELD },
    ]);
    yield* requireOwnedBusiness(businessId, session.user.id);

    // Scoped to the business the caller was just authorized for. Matching on
    // `id` alone let an owner pass their own `businessId` past the check above
    // and then edit a row belonging to someone else.
    const db = yield* Db;
    const service = yield* db.use((p) =>
      p.service.update({
        where: { id, businessId },
        data: {
          icon: typeof body.icon === "string" ? body.icon : undefined,
          title: typeof body.title === "string" ? body.title : undefined,
          description:
            typeof body.description === "string" ? body.description : undefined,
          position:
            typeof body.position === "number" ? body.position : undefined,
        },
        select: {
          id: true,
          icon: true,
          title: true,
          description: true,
          position: true,
        },
      }),
    );
    return { service };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const DELETE = handler(
  "marketplace.services.delete",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    yield* db.use((p) => p.service.delete({ where: { id, businessId } }));
    return { deleted: true };
  }).pipe(recoverUnexpected(invalidBody)),
);
