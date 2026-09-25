import { Effect, Schema } from "effect";
import { getCompanyContacts } from "~/lib/company-profile";
import { MAX_BULK_ITEMS, MAX_SHORT_FIELD } from "~/lib/input-limits";
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
import {
  bulk,
  Position,
  trimmedMax,
  trimmedRequired,
} from "~/server/effect/schemas";
import { Db } from "~/server/effect/services/db";

/**
 * Enforces at runtime the shape a hand-written type assertion once only
 * claimed: a non-string `name` used to reach Prisma, and nothing bounded the
 * array or the strings. Rows created here are read back on every company
 * profile render.
 */
const CreateContacts = Schema.Struct({
  businessId: Schema.NonEmptyString,
  contacts: bulk(
    Schema.Struct({
      name: trimmedRequired(MAX_SHORT_FIELD),
      role: trimmedMax(MAX_SHORT_FIELD),
      avatarUrl: Schema.optional(Schema.NullOr(Schema.String)),
      email: Schema.optional(Schema.NullOr(trimmedMax(MAX_SHORT_FIELD))),
      position: Schema.optional(Position),
    }),
  ),
});

const invalidBody = new BadRequest({ message: "Invalid request body" });

export const GET = handler(
  "marketplace.contacts.list",
  Effect.gen(function* () {
    const businessId = yield* requireQueryParam(
      "businessId",
      "businessId is required",
    );
    const contacts = yield* getCompanyContacts(businessId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[marketplace/contacts] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load contacts" }),
      ),
    );
    return { contacts };
  }),
);

export const POST = handler(
  "marketplace.contacts.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { businessId, contacts } = yield* decodeJsonBody(
      CreateContacts,
      () =>
        new BadRequest({
          message: `Between 1 and ${MAX_BULK_ITEMS} valid contacts are required`,
        }),
    );
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    const created = yield* db.use((p) =>
      p.businessContact.createMany({
        data: contacts.map((c) => ({
          businessId,
          name: c.name,
          role: c.role,
          // Rendered into `<img src>` on the public profile.
          avatarUrl:
            typeof c.avatarUrl === "string" ? imageSrc(c.avatarUrl) : null,
          email: c.email ?? null,
          position: c.position ?? 0,
        })),
      }),
    );
    return { created: created.count };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const PATCH = handler(
  "marketplace.contacts.update",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);

    yield* checkFieldLimits([
      { label: "Name", value: body.name, max: MAX_SHORT_FIELD },
      { label: "Role", value: body.role, max: MAX_SHORT_FIELD },
      { label: "Email", value: body.email, max: MAX_SHORT_FIELD },
    ]);
    yield* requireOwnedBusiness(businessId, session.user.id);

    // Scoped to the business the caller was just authorized for. Matching on
    // `id` alone let an owner pass their own `businessId` past the check above
    // and then edit a row belonging to someone else.
    const db = yield* Db;
    const contact = yield* db.use((p) =>
      p.businessContact.update({
        where: { id, businessId },
        data: {
          name: typeof body.name === "string" ? body.name : undefined,
          role: typeof body.role === "string" ? body.role : undefined,
          // Same gate as the logo. A non-string (the client sends `null`)
          // leaves the stored value alone.
          avatarUrl:
            typeof body.avatarUrl === "string"
              ? imageSrc(body.avatarUrl)
              : undefined,
          email: typeof body.email === "string" ? body.email : undefined,
          position:
            typeof body.position === "number" ? body.position : undefined,
        },
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
          email: true,
          position: true,
        },
      }),
    );
    return { contact };
  }).pipe(recoverUnexpected(invalidBody)),
);

export const DELETE = handler(
  "marketplace.contacts.delete",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(() => invalidBody);
    const { id, businessId } = yield* requireItemRef(body);
    yield* requireOwnedBusiness(businessId, session.user.id);

    const db = yield* Db;
    yield* db.use((p) =>
      p.businessContact.delete({ where: { id, businessId } }),
    );
    return { deleted: true };
  }).pipe(recoverUnexpected(invalidBody)),
);
