import { Effect } from "effect";
import {
  copyFieldTitle,
  defaultFieldTitle,
  type FieldType,
  fitsFieldType,
  isFieldType,
  MAX_FIELD_COLUMNS,
} from "~/lib/task-fields";
import { BadRequest, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";
import { placeInOrder, renumberFields } from "~/server/task-field-rules";

const fieldSelect = { id: true, title: true, type: true } as const;

/** The team's added columns and every value filled in under them. */
export const GET = handler(
  "taskFields.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    const db = yield* Db;
    const fields = yield* db.use((p) =>
      p.taskField.findMany({
        where: { businessId: ctx.businessId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: fieldSelect,
      }),
    );
    const rows = yield* db.use((p) =>
      p.taskFieldValue.findMany({
        where: { field: { businessId: ctx.businessId } },
        select: { taskId: true, fieldId: true, value: true },
      }),
    );

    const known = fields.filter((f) => isFieldType(f.type));
    const types = new Map(known.map((f) => [f.id, f.type]));
    return {
      fields: known,
      // A value that no longer fits its column's type is left out, not sent.
      values: rows.filter((r) => {
        const type = types.get(r.fieldId);
        return type !== undefined && fitsFieldType(type as FieldType, r.value);
      }),
    };
  }),
);

const optionalId = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

/**
 * Adds a column: a new one of `type`, or a copy of `duplicateOf` (values
 * included). It goes at the end unless `beforeId` / `afterId` names a column
 * to sit next to.
 */
export const POST = handler(
  "taskFields.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only the owner or an admin can add columns",
    );

    return yield* Effect.gen(function* () {
      const body = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      const duplicateOf = optionalId(body.duplicateOf);
      const beforeId = optionalId(body.beforeId);
      const afterId = optionalId(body.afterId);
      if (beforeId && afterId) {
        return yield* new BadRequest({ message: "Invalid request body" });
      }
      if (!duplicateOf && !isFieldType(body.type)) {
        return yield* new BadRequest({ message: "Unknown column type" });
      }

      const db = yield* Db;
      const existing = yield* db.use((p) =>
        p.taskField.findMany({
          where: { businessId: ctx.businessId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, type: true },
        }),
      );
      if (existing.length >= MAX_FIELD_COLUMNS) {
        return yield* new BadRequest({
          message: `A table can have up to ${MAX_FIELD_COLUMNS} added columns`,
        });
      }

      const source = duplicateOf
        ? existing.find((f) => f.id === duplicateOf)
        : undefined;
      if (duplicateOf && !source) {
        return yield* new NotFound({ message: "Column not found" });
      }
      const type = source ? source.type : body.type;
      if (!isFieldType(type)) {
        return yield* new BadRequest({ message: "Unknown column type" });
      }

      const ids = existing.map((f) => f.id);
      if (placeInOrder(ids, "new", { beforeId, afterId }) === null) {
        return yield* new NotFound({ message: "Column not found" });
      }

      const titles = existing.map((f) => f.title);
      const title = source
        ? copyFieldTitle(source.title, titles)
        : defaultFieldTitle(type, titles);

      const created = yield* db.transaction(
        Effect.gen(function* () {
          const tx = yield* Db;
          const field = yield* tx.use((p) =>
            p.taskField.create({
              data: {
                businessId: ctx.businessId,
                type,
                title,
                position: existing.length,
              },
              select: fieldSelect,
            }),
          );
          if (source) {
            yield* tx.use(async (p) => {
              const rows = await p.taskFieldValue.findMany({
                where: { fieldId: source.id },
                select: { taskId: true, value: true },
              });
              if (rows.length === 0) return;
              await p.taskFieldValue.createMany({
                data: rows.map((r) => ({
                  taskId: r.taskId,
                  fieldId: field.id,
                  value: r.value as never,
                })),
              });
            });
          }
          yield* renumberFields(
            placeInOrder(ids, field.id, { beforeId, afterId }) ?? [],
          );
          return field;
        }),
      );
      return Response.json(created, { status: 201 });
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
