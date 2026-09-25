import { Effect, Schema } from "effect";
import { BadRequest } from "~/server/effect/errors";
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

export const GET = handler(
  "tasks.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    // Also resolves businesses for owners whose `businessId` column is
    // stale/NULL -- see the note in lib/business-context.ts.
    const ctx = yield* requireBusinessContext(session.user.id);

    const { url } = yield* RequestContext;
    const assigneeId = url.searchParams.get("assigneeId");

    const db = yield* Db;
    return yield* db.use((p) =>
      p.task.findMany({
        where: {
          businessId: ctx.businessId,
          ...(assigneeId ? { assigneeId } : {}),
        },
        include: assigneeInclude,
        orderBy: [{ column: "asc" }, { position: "asc" }],
      }),
    );
  }),
);

export const POST = handler(
  "tasks.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    return yield* Effect.gen(function* () {
      const { title, description, column, priority, dueDate, assigneeId } =
        yield* readJsonObject(
          () => new BadRequest({ message: "Invalid request body" }),
        );

      if (typeof title !== "string" || !title.trim()) {
        return yield* new BadRequest({ message: "Title is required" });
      }
      if (typeof assigneeId !== "string" || !assigneeId) {
        return yield* new BadRequest({ message: "Assignee is required" });
      }
      yield* requireTeamAssignee(assigneeId, ctx.businessId);

      const taskColumn = Schema.is(TaskColumn)(column) ? column : "todo";
      const taskPriority = Schema.is(TaskPriority)(priority)
        ? priority
        : "medium";

      const db = yield* Db;
      const maxPosition = yield* db.use((p) =>
        p.task.aggregate({
          where: { businessId: ctx.businessId, column: taskColumn },
          _max: { position: true },
        }),
      );

      const task = yield* db.use((p) =>
        p.task.create({
          data: {
            title: title.trim(),
            description:
              (description as string | null | undefined)?.trim() || null,
            column: taskColumn,
            priority: taskPriority,
            dueDate: dueDate ? new Date(dueDate as string) : null,
            position: (maxPosition._max.position ?? -1) + 1,
            assigneeId,
            businessId: ctx.businessId,
          },
          include: assigneeInclude,
        }),
      );
      return Response.json(task, { status: 201 });
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
