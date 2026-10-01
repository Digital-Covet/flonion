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
  assigneesForCreate,
  completedAtFor,
  readAssigneeIds,
  requireTeamAssignees,
  TaskColumn,
  TaskPriority,
  withAssignees,
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
    const tasks = yield* db.use((p) =>
      p.task.findMany({
        where: {
          businessId: ctx.businessId,
          // Anyone on the task counts, not only its lead.
          ...(assigneeId
            ? {
                OR: [
                  { assigneeId },
                  { coAssignees: { some: { userId: assigneeId } } },
                ],
              }
            : {}),
        },
        include: assigneeInclude,
        orderBy: [{ column: "asc" }, { position: "asc" }],
      }),
    );
    return tasks.map(withAssignees);
  }),
);

export const POST = handler(
  "tasks.create",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);

    return yield* Effect.gen(function* () {
      const {
        title,
        description,
        column,
        priority,
        dueDate,
        assigneeId,
        assigneeIds,
        parentId,
      } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );

      if (typeof title !== "string" || !title.trim()) {
        return yield* new BadRequest({ message: "Title is required" });
      }
      const assignees = yield* readAssigneeIds(assigneeIds, assigneeId);
      if (!assignees) {
        return yield* new BadRequest({ message: "Assignee is required" });
      }
      yield* requireTeamAssignees(assignees, ctx.businessId);

      const taskColumn = Schema.is(TaskColumn)(column) ? column : "todo";
      const taskPriority = Schema.is(TaskPriority)(priority)
        ? priority
        : "medium";

      const db = yield* Db;

      let parent: string | null = null;
      if (parentId !== undefined && parentId !== null) {
        if (typeof parentId !== "string") {
          return yield* new BadRequest({ message: "Invalid parent task" });
        }
        const found = yield* db.use((p) =>
          p.task.findUnique({
            where: { id: parentId },
            select: { businessId: true, parentId: true },
          }),
        );
        if (!found || found.businessId !== ctx.businessId) {
          return yield* new BadRequest({ message: "Invalid parent task" });
        }
        if (found.parentId) {
          return yield* new BadRequest({
            message: "Subtasks can't have subtasks of their own",
          });
        }
        parent = parentId;
      }

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
            completedAt: completedAtFor(null, taskColumn),
            ...assigneesForCreate(assignees),
            parentId: parent,
            businessId: ctx.businessId,
          },
          include: assigneeInclude,
        }),
      );
      return Response.json(withAssignees(task), { status: 201 });
    }).pipe(
      recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
    );
  }),
);
