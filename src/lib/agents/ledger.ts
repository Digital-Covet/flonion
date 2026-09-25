import { Effect } from "effect";
import { orElseAll } from "~/server/effect/guards";
import { Db } from "~/server/effect/services/db";
import { computeCost } from "./model";

/**
 * Token usage of one model call. Zeros when the provider reported none;
 * `model` is "none" for a stage answered without calling the model.
 */
export interface UsageMeta {
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface LedgerEntry {
  endpoint: string;
  stage: string;
  usage: UsageMeta;
  latencyMs: number;
  ok: boolean;
  errorKind?: string | null;
  userId?: string | null;
  businessId?: string | null;
  reviewId?: string | null;
  ip?: string | null;
}

/**
 * Writes a usage row to the ledger. Never fails: a ledger insert must never
 * turn a working AI call into a 500, so errors are logged and dropped. Run it
 * off the request's critical path.
 *
 * The cost is computed at write time so a later price change does not
 * silently rewrite history.
 */
export const writeLedger = (
  entry: LedgerEntry,
): Effect.Effect<void, never, Db> =>
  Db.use((db) =>
    db.use((p) =>
      p.aiUsage.create({
        data: {
          endpoint: entry.endpoint,
          stage: entry.stage,
          model: entry.usage.model,
          promptTokens: entry.usage.promptTokens,
          completionTokens: entry.usage.completionTokens,
          costUsd: computeCost(
            entry.usage.model,
            entry.usage.promptTokens,
            entry.usage.completionTokens,
          ),
          latencyMs: entry.latencyMs,
          ok: entry.ok,
          errorKind: entry.errorKind ?? null,
          userId: entry.userId ?? null,
          businessId: entry.businessId ?? null,
          reviewId: entry.reviewId ?? null,
          ip: entry.ip ?? null,
        },
      }),
    ),
  ).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        console.error("[ai-usage] ledger write failed:", cause),
      ),
    ),
    orElseAll(() => undefined),
  );
