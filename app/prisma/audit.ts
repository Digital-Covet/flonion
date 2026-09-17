import { db } from "./db";
import type { Operator } from "./operator";

export interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string;
  ip?: string;
}

/**
 * Record an operator action in the audit log.
 *
 * Called INSIDE the same `db.transaction()` as the mutation it describes,
 * so a write cannot land unlogged. The caller must pass the transactional
 * db client; this function does not start its own transaction.
 *
 * @param operator - The authenticated operator performing the action.
 * @param entry - The audit log entry.
 * @param tx - The Prisma transaction client from `db.$transaction(...)`.
 */
export async function recordAudit(
  operator: Operator,
  entry: AuditEntry,
  tx: typeof db,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      operatorId: operator.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      note: entry.note ?? undefined,
      ip: entry.ip ?? undefined,
    },
  });
}
