import { Prisma } from "@generated/prisma/client";
import { Context, Effect, Exit, Layer } from "effect";
import { prisma } from "~/db/prisma";
import { DbError } from "../errors";

/**
 * What queries run against: the process-wide client, or the transaction
 * client inside `Db.transaction`. The transaction client lacks `$transaction`
 * and `$connect`, so nesting a transaction is a type error rather than a
 * silent second connection.
 */
export type DbClient = Prisma.TransactionClient;

export interface TransactionOptions {
  readonly maxWait?: number;
  readonly timeout?: number;
  readonly isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Carries a failed program's `Exit` out of Prisma's callback. Prisma only
 * rolls back when the callback throws, so a typed failure has to be thrown
 * through it and turned back into the same failure afterwards.
 */
class RollbackSignal {
  constructor(readonly exit: Exit.Exit<unknown, unknown>) {}
}

/** Keeps Prisma's error code (P2002, P2025, ...) so callers can match on it. */
export function toDbError(cause: unknown): DbError {
  const code =
    cause instanceof Prisma.PrismaClientKnownRequestError
      ? cause.code
      : undefined;
  return code === undefined
    ? new DbError({ cause })
    : new DbError({ code, cause });
}

export class Db extends Context.Service<
  Db,
  {
    /** Runs one Prisma call; a rejection becomes a `DbError`. */
    readonly use: <A>(
      f: (client: DbClient) => Promise<A>,
    ) => Effect.Effect<A, DbError>;
    /**
     * Runs `program` in an interactive transaction. Any failure, typed or not,
     * rolls it back and is re-raised unchanged. Inside, `Db` is bound to the
     * transaction client, so `program` reads it with `yield* Db` like any
     * other code. Never retried: the caller decides.
     */
    readonly transaction: <A, E, R>(
      program: Effect.Effect<A, E, R>,
      options?: TransactionOptions,
    ) => Effect.Effect<A, E | DbError, Exclude<R, Db>>;
  }
>()("revme/Db") {
  static readonly layer = Layer.sync(Db, () => makeDb(prisma));
}

function useWith(client: DbClient) {
  return <A>(f: (client: DbClient) => Promise<A>) =>
    Effect.tryPromise({ try: () => f(client), catch: toDbError });
}

/** Exported for tests, which pass a fake root client. */
export function makeDb(
  root: Pick<typeof prisma, "$transaction"> & DbClient,
): Db["Service"] {
  return Db.of({
    use: useWith(root),
    transaction: <A, E, R>(
      program: Effect.Effect<A, E, R>,
      options?: TransactionOptions,
    ) =>
      Effect.gen(function* () {
        const context = yield* Effect.context<Exclude<R, Db>>();
        const result = yield* Effect.tryPromise({
          try: () =>
            root.$transaction(async (tx) => {
              const exit = await Effect.runPromiseExitWith(context)(
                Effect.provideService(program, Db, boundTo(tx)),
              );
              if (Exit.isFailure(exit)) throw new RollbackSignal(exit);
              return exit;
            }, options),
          catch: (cause) =>
            cause instanceof RollbackSignal ? cause : toDbError(cause),
        }).pipe(
          Effect.catch((error) =>
            error instanceof RollbackSignal
              ? Effect.succeed(error.exit as Exit.Exit<A, E>)
              : Effect.fail(error),
          ),
        );
        return yield* result;
      }),
  });
}

/** A `Db` whose queries run on `tx`; a nested `transaction` joins it. */
function boundTo(tx: DbClient): Db["Service"] {
  const self: Db["Service"] = Db.of({
    use: useWith(tx),
    transaction: (program) => Effect.provideService(program, Db, self),
  });
  return self;
}

/** A unique-constraint violation (P2002) becomes `onDuplicate()`. */
export const catchUniqueViolation =
  <E2>(onDuplicate: () => E2) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.catchIf(
      self,
      (e): e is Extract<E, DbError> =>
        e instanceof DbError && e.code === "P2002",
      () => Effect.fail(onDuplicate()),
    );
