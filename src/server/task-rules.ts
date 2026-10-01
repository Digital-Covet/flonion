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

export const assigneeInclude = {
  assignee: { select: { id: true, name: true, email: true, image: true } },
} as const;

/**
 * The assignee must be a member of this business. The task response includes
 * the assignee's name, email and avatar, so an unchecked id turned task
 * creation into a lookup for any user in the system -- besides assigning work
 * to someone who cannot see it.
 */
export const requireTeamAssignee = Effect.fn("requireTeamAssignee")(function* (
  assigneeId: string,
  businessId: string,
) {
  const db = yield* Db;
  const assignee = yield* db.use((p) =>
    p.user.findFirst({
      where: { id: assigneeId, businessId },
      select: { id: true },
    }),
  );
  if (!assignee) {
    return yield* new BadRequest({
      message: "Assignee is not a member of this team",
    });
  }
});
