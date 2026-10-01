import { Effect, Schema } from "effect";
import { BadRequest } from "~/server/effect/errors";
import { Db } from "~/server/effect/services/db";

/*
 * Server-only rules shared by the /api/tasks routes.
 */

export const TaskColumn = Schema.Literals([
  "todo",
  "in_progress",
  "waiting",
  "done",
]);
export const TaskPriority = Schema.Literals(["low", "medium", "high"]);

/**
 * `completedAt` for a task going from `from` to `to` (`from` is null for a new
 * task): stamped when it lands in Done, cleared when it leaves, and left alone
 * (`undefined`) otherwise — so reordering inside Done keeps the original date.
 */
export function completedAtFor(
  from: string | null,
  to: string,
  now = new Date(),
): Date | null | undefined {
  if (from === to) return undefined;
  if (to === "done") return now;
  return from === "done" ? null : undefined;
}

const personSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

/**
 * A task has one lead (`assignee`, from `assigneeId`) and may have more people
 * beside them (`coAssignees`). Routes include both and answer with
 * `withAssignees`, so clients get one `assignees` list, lead first.
 */
export const assigneeInclude = {
  assignee: { select: personSelect },
  coAssignees: {
    select: { user: { select: personSelect } },
    orderBy: { createdAt: "asc" },
  },
} as const;

/** What it takes to know who is on a task, for the edit-permission check. */
export const assigneeAccessSelect = {
  assigneeId: true,
  coAssignees: { select: { userId: true } },
} as const;

/** Whether `userId` is the task's lead or one of its other assignees. */
export function isOnTask(
  task: { assigneeId: string; coAssignees?: { userId: string }[] },
  userId: string,
): boolean {
  return (
    task.assigneeId === userId ||
    (task.coAssignees ?? []).some((c) => c.userId === userId)
  );
}

type Person = { id: string; name: string; email: string; image: string | null };

/** The task with `assignees` (lead first) in place of the raw join rows. */
export function withAssignees<
  T extends { assignee?: Person | null; coAssignees?: { user: Person }[] },
>(task: T) {
  const { coAssignees, ...rest } = task;
  const assignees = [
    ...(task.assignee ? [task.assignee] : []),
    ...(Array.isArray(coAssignees) ? coAssignees : []).map((c) => c.user),
  ];
  return { ...rest, assignees };
}

export const MAX_ASSIGNEES = 10;

/**
 * The assignees a request names: `assigneeIds` (lead first), or the older
 * single `assigneeId`. `undefined` when it names none, so an update that
 * doesn't mention assignees leaves them alone.
 */
export const readAssigneeIds = Effect.fn("readAssigneeIds")(function* (
  assigneeIds: unknown,
  assigneeId: unknown,
) {
  const raw =
    assigneeIds !== undefined
      ? assigneeIds
      : typeof assigneeId === "string"
        ? [assigneeId]
        : undefined;
  if (raw === undefined) return undefined;
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.some((id) => typeof id !== "string" || !id)
  ) {
    return yield* new BadRequest({ message: "Assignee is required" });
  }
  const ids = [...new Set(raw as string[])];
  if (ids.length > MAX_ASSIGNEES) {
    return yield* new BadRequest({
      message: `A task can have up to ${MAX_ASSIGNEES} assignees`,
    });
  }
  return ids;
});

/**
 * Every assignee must be a member of this business. The task response includes
 * each assignee's name, email and avatar, so an unchecked id turned task
 * creation into a lookup for any user in the system -- besides assigning work
 * to someone who cannot see it.
 */
export const requireTeamAssignees = Effect.fn("requireTeamAssignees")(
  function* (assigneeIds: readonly string[], businessId: string) {
    const db = yield* Db;
    const found = yield* db.use((p) =>
      p.user.findMany({
        where: { id: { in: [...assigneeIds] }, businessId },
        select: { id: true },
      }),
    );
    if (found.length !== new Set(assigneeIds).size) {
      return yield* new BadRequest({
        message: "Assignee is not a member of this team",
      });
    }
  },
);

/** `ids[0]` becomes the lead and the rest co-assignees, for a new task. */
export function assigneesForCreate(ids: readonly string[]) {
  return {
    assigneeId: ids[0],
    coAssignees: { create: ids.slice(1).map((userId) => ({ userId })) },
  };
}

/** The same, replacing whoever was on the task before. */
export function assigneesForUpdate(ids: readonly string[]) {
  return {
    assigneeId: ids[0],
    coAssignees: {
      deleteMany: {},
      create: ids.slice(1).map((userId) => ({ userId })),
    },
  };
}
