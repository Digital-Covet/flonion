import { Effect, Schema } from "effect";
import { getCompanyProjects } from "~/lib/company-profile";
import { MAX_BULK_ITEMS, MAX_MEDIUM_FIELD } from "~/lib/input-limits";
import { imageSrc } from "~/lib/safe-url";
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
 * Bounds both the array and each field. `imageUrl` is rendered into
 * `<img src>` on the public profile, so it must pass the same gate as the
 * logo rather than being stored as typed.
 */
const ImageUrl = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value: string) => imageSrc(value) !== null, {
      message: "Image must be a full http(s) link or an inline image",
    }),
  ),
);

const CreateProjects = Schema.Struct({
  businessId: Schema.NonEmptyString,
  projects: bulk(
    Schema.Struct({
      imageUrl: ImageUrl,
      altText: trimmedMax(MAX_MEDIUM_FIELD),
      position: Schema.optional(Position),
    }),
  ),
});

const invalidBody = new BadRequest({ message: "Invalid request body" });

export const GET = handler(
  "marketplace.projects.list",
  Effect.gen(function* () {
    const businessId = yield* requireQueryParam(
      "businessId",
      "businessId is required",
    );
    const projects = yield* getCompanyProjects(businessId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[marketplace/projects] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load projects" }),
      ),
    );
    return { projects };
  }),
);

export const POST = handler(
  "marketplace.projects.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { businessId, projects } = yield* decodeJsonBody(
      CreateProjects,
      () =>
        new BadRequest({
          message: `Between 1 and ${MAX_BULK_ITEMS} valid projects are required`,
        }),
    );
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    const created = yield* db.use((p) =>
      p.project.createMany({
        data: projects.map((project) => ({
          businessId,
          // Checked by `ImageUrl`, so never null here.
          imageUrl: imageSrc(project.imageUrl) as string,
          altText: project.altText,
          position: project.position ?? 0,
        })),
      }),
    );
    return { created: created.count };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const PATCH = handler(
  "marketplace.projects.update",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);

    yield* checkFieldLimits([
      { label: "Alt text", value: body.altText, max: MAX_MEDIUM_FIELD },
    ]);
    yield* requireOwnedBusiness(businessId, session.user.id);

    // Scoped to the business the caller was just authorized for. Matching on
    // `id` alone let an owner pass their own `businessId` past the check above
    // and then edit a row belonging to someone else.
    const db = yield* Db;
    const project = yield* db.use((p) =>
      p.project.update({
        where: { id, businessId },
        data: {
          imageUrl:
            typeof body.imageUrl === "string"
              ? (imageSrc(body.imageUrl) ?? undefined)
              : undefined,
          altText: typeof body.altText === "string" ? body.altText : undefined,
          position:
            typeof body.position === "number" ? body.position : undefined,
        },
        select: { id: true, imageUrl: true, altText: true, position: true },
      }),
    );
    return { project };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const DELETE = handler(
  "marketplace.projects.delete",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    yield* db.use((p) => p.project.delete({ where: { id, businessId } }));
    return { deleted: true };
  }).pipe(recoverUnexpected(invalidBody)),
);
