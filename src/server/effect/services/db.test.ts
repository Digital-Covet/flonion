import { Effect, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";
import { NotFound } from "../errors";
import { Db, makeDb } from "./db";

/** A root client whose `$transaction` records whether it committed. */
function fakeRoot() {
  const log: string[] = [];
  const tx = { tag: "tx" };
  const root = {
    tag: "root",
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      try {
        const value = await fn(tx);
        log.push("commit");
        return value;
      } catch (error) {
        log.push("rollback");
        throw error;
      }
    }),
  };
  return { root, client: root as unknown as Parameters<typeof makeDb>[0], log };
}

const whichClient = Effect.gen(function* () {
  const db = yield* Db;
  return yield* db.use(async (c) => (c as unknown as { tag: string }).tag);
});

describe("Db.transaction", () => {
  it("binds Db to the transaction client and commits on success", async () => {
    const { client, log } = fakeRoot();
    const db = makeDb(client);
    const result = await Effect.runPromise(
      db.transaction(whichClient).pipe(Effect.provideService(Db, db)),
    );
    expect(result).toBe("tx");
    expect(log).toEqual(["commit"]);
  });

  it("rolls back on a typed failure and re-raises it unchanged", async () => {
    const { client, log } = fakeRoot();
    const db = makeDb(client);
    const exit = await Effect.runPromiseExit(
      db
        .transaction(
          Effect.gen(function* () {
            yield* whichClient;
            return yield* new NotFound({ message: "gone" });
          }),
        )
        .pipe(Effect.provideService(Db, db)),
    );
    expect(log).toEqual(["rollback"]);
    expect(exit).toEqual(Exit.fail(new NotFound({ message: "gone" })));
  });

  it("joins an outer transaction instead of opening a second one", async () => {
    const { root, client } = fakeRoot();
    const db = makeDb(client);
    await Effect.runPromise(
      db
        .transaction(
          Effect.gen(function* () {
            const inner = yield* Db;
            return yield* inner.transaction(whichClient);
          }),
        )
        .pipe(Effect.provideService(Db, db)),
    );
    expect(root.$transaction).toHaveBeenCalledOnce();
  });
});
