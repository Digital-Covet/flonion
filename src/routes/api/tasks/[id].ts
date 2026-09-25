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
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import {
  assigneeInclude,
  requireTeamAssignee,
  TaskColumn,
  TaskPriority,
} from "~/server/task-rules";

const taskId = RequestContext.use(({ params }) => Effect.succeed(params.id));

/** Owner/admins may modify any task; members only tasks assigned to them. */
const requireEditableTask = Effect.fn("requireEditableTask")(function* (
  id: string,
) {
  const session = yield* requireSession();
  const ctx = yield* requireBusinessContext(session.user.id);

  const db = yield* Db;
  const task = yield* db.use((p) =>
    p.task.findUnique({
      where: { id },
      select: { businessId: true, assigneeId: true },
    }),
  );
  if (!task || task.businessId !== ctx.businessId) {
    return yield* new NotFound({ message: "Task not found" });
  }
  if (!canManageTeam(ctx) && task.assigneeId !== ctx.userId) {
    return yield* new Forbidden({
      message: "Only the assignee, an admin, or the owner can modify this task",
    });
  }
  return ctx;
});

export const GET = handler(
  "tasks.get",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const id = yield* taskId;

    const db = yield* Db;
    const task = yield* db.use((p) =>
      p.task.findUnique({ where: { id }, include: assigneeInclude }),
    );
    if (!task) return yield* new NotFound({ message: "Task not found" });

    // Also resolves businesses for owners whose `businessId` column is
    // stale/NULL -- see the note in lib/business-context.ts.
    const ctx = yield* requireBusinessContext(session.user.id).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.fail(new Forbidden({ message: "Forbidden" })),
      ),
    );
    if (task.businessId !== ctx.businessId) {
      return yield* new Forbidden({ message: "Forbidden" });
    }
    return task;
  }),
);

export const PATCH = handler(
  "tasks.update",
  Effect.gen(function* () {
    const id = yield* taskId;
    const ctx = yield* requireEditableTask(id);

    return yield* Effect.gen(function* () {
      const { title, description, column, priority, dueDate, assigneeId } =
        yield* readJsonObject(
          () => new BadRequest({ message: "Invalid request body" }),
        );

      const data: Record<string, unknown> = {};
      if (typeof title === "string" && title.trim()) {
        data.title = title.trim();
      }
      if (description !== undefined) {
        data.description = (description as string | null)?.trim() || null;
      }
      if (Schema.is(TaskColumn)(column)) data.column = column;
      if (Schema.is(TaskPriority)(priority)) data.priority = priority;
      if (dueDate !== undefined) {
        data.dueDate = dueDate ? new Date(dueDate as string) : null;
      }
      if (typeof assigneeId === "string") {
        yield* requireTeamAssignee(assigneeId, ctx.businessId);
        data.assigneeId = assigneeId;
      }

      const db = yield* Db;
      return yield* db.use((p) =>
        p.task.update({ where: { id }, data, include: assigneeInclude }),
      );
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);

export const DELETE = handler(
  "tasks.delete",
  Effect.gen(function* () {
    const id = yield* taskId;
    yield* requireEditableTask(id);

    const db = yield* Db;
    yield* db.use((p) => p.task.delete({ where: { id } }));
    return { success: true };
  }),
);
