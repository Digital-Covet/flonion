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
