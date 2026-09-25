import { Effect, Schema } from "effect";
import { canManageTeam } from "~/lib/business-context";
import { BadRequest, Forbidden, NotFound } from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";
import { TaskColumn } from "~/server/task-rules";

export const PATCH = handler(
  "tasks.reorder",
  Effect.gen(function* () {
    const session = yield* requireSession();
    // Also resolves businesses for owners whose `businessId` column is
    // stale/NULL -- see the note in lib/business-context.ts.
    const ctx = yield* requireBusinessContext(session.user.id);
    const businessId = ctx.businessId;

    return yield* Effect.gen(function* () {
      const { taskId, targetColumn, newPosition } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );

      if (
        typeof taskId !== "string" ||
        typeof targetColumn !== "string" ||
        typeof newPosition !== "number"
      ) {
        return yield* new BadRequest({ message: "Invalid parameters" });
      }
      if (!Schema.is(TaskColumn)(targetColumn)) {
        return yield* new BadRequest({ message: "Invalid column" });
      }

      const db = yield* Db;
      const existing = yield* db.use((p) =>
        p.task.findUnique({
          where: { id: taskId },
          select: {
            businessId: true,
            column: true,
            position: true,
            assigneeId: true,
          },
        }),
      );
      if (!existing || existing.businessId !== businessId) {
        return yield* new NotFound({ message: "Task not found" });
      }

      // A move is an edit: owner/admins may move any task, members only
      // their own.
      if (!canManageTeam(ctx) && existing.assigneeId !== ctx.userId) {
        return yield* new Forbidden({
          message:
            "Only the assignee, an admin, or the owner can move this task",
        });
      }

      const oldColumn = existing.column;
      const oldPosition = existing.position;

      yield* db.transaction(
        Effect.gen(function* () {
          const tx = yield* Db;
          const shift = (
            column: string,
            position: Record<string, number>,
            by: "increment" | "decrement",
          ) =>
            tx.use((p) =>
              p.task.updateMany({
                where: { businessId, column, position },
                data: { position: { [by]: 1 } },
              }),
            );

          if (oldColumn === targetColumn) {
            if (oldPosition < newPosition) {
              yield* shift(
                targetColumn,
                { gt: oldPosition, lte: newPosition },
                "decrement",
              );
            } else if (oldPosition > newPosition) {
              yield* shift(
                targetColumn,
                { gte: newPosition, lt: oldPosition },
                "increment",
              );
            }
          } else {
            yield* shift(oldColumn, { gt: oldPosition }, "decrement");
            yield* shift(targetColumn, { gte: newPosition }, "increment");
          }

          yield* tx.use((p) =>
            p.task.update({
              where: { id: taskId },
              data: { column: targetColumn, position: newPosition },
            }),
          );
        }),
      );

      return { success: true };
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
