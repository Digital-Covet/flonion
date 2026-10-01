import { Effect } from "effect";
import {
  convertFieldValue,
  type FieldType,
  type FieldValue,
  isFieldType,
  normalizeFieldTitle,
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
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import { moveInOrder, renumberFields } from "~/server/task-field-rules";

const fieldId = RequestContext.use(({ params }) => Effect.succeed(params.id));
const fieldSelect = { id: true, title: true, type: true } as const;

/**
 * Changing the table's structure is for the owner and admins. A column of
 * another team answers 404, the same as one that doesn't exist.
 */
const requireManagedField = Effect.fn("requireManagedField")(function* (
  id: string,
) {
  const session = yield* requireSession();
  const ctx = yield* requireBusinessContext(session.user.id);
  yield* requireTeamManager(ctx, "Only the owner or an admin can edit columns");

  const db = yield* Db;
  const field = yield* db.use((p) =>
    p.taskField.findUnique({
      where: { id },
      select: { businessId: true, type: true, title: true },
    }),
  );
  if (
    !field ||
    field.businessId !== ctx.businessId ||
    !isFieldType(field.type)
  ) {
    return yield* new NotFound({ message: "Column not found" });
  }
  return { ctx, type: field.type, title: field.title };
});

/**
 * Edits a column. Any of: `title` (blank falls back to the type's name),
 * `type` (values are converted where they can be and dropped where they
 * can't), and `move` ("left" or "right" one place).
 */
export const PATCH = handler(
  "taskFields.update",
  Effect.gen(function* () {
    const id = yield* fieldId;
    const { ctx, type: currentType } = yield* requireManagedField(id);

    return yield* Effect.gen(function* () {
      const { title, type, move } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      if (title !== undefined && typeof title !== "string") {
        return yield* new BadRequest({ message: "Invalid title" });
      }
      if (type !== undefined && !isFieldType(type)) {
        return yield* new BadRequest({ message: "Unknown column type" });
      }
      if (move !== undefined && move !== "left" && move !== "right") {
        return yield* new BadRequest({ message: "Invalid move" });
      }
      const nextType: FieldType =
        (type as FieldType | undefined) ?? currentType;

      const db = yield* Db;
      return yield* db.transaction(
        Effect.gen(function* () {
          const tx = yield* Db;

          if (nextType !== currentType) {
            yield* tx.use(async (p) => {
              const rows = await p.taskFieldValue.findMany({
                where: { fieldId: id },
                select: { taskId: true, value: true },
              });
              for (const row of rows) {
                const converted = convertFieldValue(
                  currentType,
                  nextType,
                  row.value as FieldValue,
                );
                const key = {
                  taskId_fieldId: { taskId: row.taskId, fieldId: id },
                };
                if (converted === null) {
                  await p.taskFieldValue.delete({ where: key });
                } else {
                  await p.taskFieldValue.update({
                    where: key,
                    data: { value: converted },
                  });
                }
              }
            });
          }

          if (move) {
            const ordered = yield* tx.use((p) =>
              p.taskField.findMany({
                where: { businessId: ctx.businessId },
                orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                select: { id: true },
              }),
            );
            yield* renumberFields(
              moveInOrder(
                ordered.map((f) => f.id),
                id,
                move,
              ),
            );
          }

          return yield* tx.use((p) =>
            p.taskField.update({
              where: { id },
              data: {
                ...(typeof title === "string"
                  ? { title: normalizeFieldTitle(title, nextType) }
                  : {}),
                ...(nextType !== currentType ? { type: nextType } : {}),
              },
              select: fieldSelect,
            }),
          );
        }),
      );
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);

/** Deletes a column; its values go with it. */
export const DELETE = handler(
  "taskFields.delete",
  Effect.gen(function* () {
    const id = yield* fieldId;
    yield* requireManagedField(id);

    const db = yield* Db;
    yield* db.use((p) => p.taskField.delete({ where: { id } }));
    return { success: true };
  }),
);
