import { Cause, Effect, Fiber, Option } from "effect";
import { type UsageMeta, writeLedger } from "~/lib/agents/ledger";
import type { Db } from "./services/db";

/*
 * Server-only. How the AI routes record spend without slowing the answer.
 */

export interface Attribution {
  userId: string | null;
  businessId: string | null;
}

interface Common {
  endpoint: "draft-reply" | "suggest-review";
  attribution: Fiber.Fiber<Attribution>;
  latencyMs: number;
  ip: string;
  reviewId?: string | null;
}

/**
 * Writes the ledger rows for a finished pipeline, off the critical path: the
 * work is detached from the request, so the response does not wait for it and
 * finishing the request does not cancel it.
 */
export const recordSuccess = (
  common: Common & {
    usage: UsageMeta[];
    stageFor: (usage: UsageMeta) => string;
  },
): Effect.Effect<void, never, Db> =>
  Effect.asVoid(
    Effect.forkDetach(
      Effect.gen(function* () {
        const { userId, businessId } = yield* Fiber.join(common.attribution);
        for (const usage of common.usage) {
          yield* writeLedger({
            endpoint: common.endpoint,
            stage: common.stageFor(usage),
            usage,
            latencyMs: Math.round(common.latencyMs / common.usage.length),
            ok: true,
            userId,
            businessId,
            reviewId: common.reviewId ?? null,
            ip: common.ip,
          });
        }
      }),
    ),
  );

/** Records a failed pipeline, detached like `recordSuccess`. */
export const recordFailure = (
  common: Common & { cause: Cause.Cause<unknown> },
): Effect.Effect<void, never, Db> =>
  Effect.asVoid(
    Effect.forkDetach(
      Effect.gen(function* () {
        const { userId, businessId } = yield* Fiber.join(common.attribution);
        const failure = Cause.findErrorOption(common.cause);
        yield* writeLedger({
          endpoint: common.endpoint,
          stage: "pipeline",
          usage: { promptTokens: 0, completionTokens: 0, model: "unknown" },
          latencyMs: common.latencyMs,
          ok: false,
          errorKind: Option.isSome(failure)
            ? ((failure.value as { _tag?: string })._tag ?? "unknown")
            : "Defect",
          userId,
          businessId,
          reviewId: common.reviewId ?? null,
          ip: common.ip,
        });
      }),
    ),
  );
