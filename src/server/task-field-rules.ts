/*
 * Server-only ordering rules for the /api/task-fields routes. Pure functions:
 * they take the columns' ids in their current order and return the new order,
 * and the route renumbers `position` to match.
 */

import { Effect } from "effect";
import { Db } from "~/server/effect/services/db";

export type Placement = { beforeId?: string; afterId?: string };

/** Writes `position` 0, 1, 2... in the given order. Run inside a transaction. */
export const renumberFields = Effect.fn("renumberFields")(function* (
  ids: readonly string[],
) {
  const db = yield* Db;
  yield* db.use(async (p) => {
    for (const [position, id] of ids.entries()) {
      await p.taskField.update({ where: { id }, data: { position } });
    }
  });
});

/**
 * `ids` with `newId` inserted before or after a named column, or at the end
 * when no placement is given. `null` when the named column isn't in the list.
 */
export function placeInOrder(
  ids: readonly string[],
  newId: string,
  placement: Placement = {},
): string[] | null {
  const anchor = placement.beforeId ?? placement.afterId;
  if (anchor === undefined) return [...ids, newId];
  const at = ids.indexOf(anchor);
  if (at === -1) return null;
  const next = [...ids];
  next.splice(placement.beforeId !== undefined ? at : at + 1, 0, newId);
  return next;
}

/** `ids` with one column swapped a place left or right; unchanged at an edge. */
export function moveInOrder(
  ids: readonly string[],
  id: string,
  direction: "left" | "right",
): string[] {
  const from = ids.indexOf(id);
  const to = direction === "left" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
