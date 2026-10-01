import { Effect } from "effect";
import { canManageTeam } from "~/lib/business-context";
import { fitsFieldType, isFieldType } from "~/lib/task-fields";
import { BadRequest, Forbidden, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";
import { assigneeAccessSelect, isOnTask } from "~/server/task-rules";

/** Empties a whole column: every task's value in it is removed. */
export const DELETE = handler(
  "taskFields.clearValues",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only the owner or an admin can clear a column",
    );

    return yield* Effect.gen(function* () {
      const { fieldId } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      if (typeof fieldId !== "string") {
        return yield* new BadRequest({ message: "Invalid request body" });
      }

      const db = yield* Db;
      const field = yield* db.use((p) =>
        p.taskField.findUnique({
          where: { id: fieldId },
          select: { businessId: true },
        }),
      );
      if (!field || field.businessId !== ctx.businessId) {
        return yield* new NotFound({ message: "Column not found" });
      }
      yield* db.use((p) => p.taskFieldValue.deleteMany({ where: { fieldId } }));
      return { success: true };
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);

/**
 * Sets (or, with `value: null`, clears) one task's value in one column. The
 * same rule as editing the task itself: the owner and admins may fill in any
 * task, a member only the ones assigned to them.
 */
export const PUT = handler(
  "taskFields.setValue",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    return yield* Effect.gen(function* () {
      const { taskId, fieldId, value } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      if (typeof taskId !== "string" || typeof fieldId !== "string") {
        return yield* new BadRequest({ message: "Invalid request body" });
      }

      const db = yield* Db;
      const task = yield* db.use((p) =>
        p.task.findUnique({
          where: { id: taskId },
          select: { businessId: true, ...assigneeAccessSelect },
        }),
      );
      if (!task || task.businessId !== ctx.businessId) {
        return yield* new NotFound({ message: "Task not found" });
      }
      if (!canManageTeam(ctx) && !isOnTask(task, ctx.userId)) {
        return yield* new Forbidden({
          message:
            "Only the assignee, an admin, or the owner can modify this task",
        });
      }

      const field = yield* db.use((p) =>
        p.taskField.findUnique({
          where: { id: fieldId },
          select: { businessId: true, type: true },
        }),
      );
      if (
        !field ||
        field.businessId !== ctx.businessId ||
        !isFieldType(field.type)
      ) {
        return yield* new NotFound({ message: "Column not found" });
      }

      if (value === null || value === undefined) {
        yield* db.use((p) =>
          p.taskFieldValue.deleteMany({ where: { taskId, fieldId } }),
        );
        return { success: true };
      }
      if (!fitsFieldType(field.type, value)) {
        return yield* new BadRequest({
          message: "That value doesn't fit this column",
        });
      }

      yield* db.use((p) =>
        p.taskFieldValue.upsert({
          where: { taskId_fieldId: { taskId, fieldId } },
          create: { taskId, fieldId, value },
          update: { value },
        }),
      );
      return { success: true };
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
